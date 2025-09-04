// ==UserScript==
// @name         通用网页脚本框架（重构版）
// @namespace    https://github.com/hjdhnx/drpy-node
// @description  日志、右下角弹窗、按钮皮肤、可配置布局、按钮集合弹窗、按钮开关、定时任务等；结构化、可扩展。
// @version      2.0.1
// @author       taoist (refactor by chatgpt)
// @match        https://www.baidu.com/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// ==/UserScript==

/**
 * 本脚本对原有“智能剪切板推送”脚本进行结构化重构，目标：
 * 1) 更易读：模块化、注释、类型提示（JSDoc）。
 * 2) 易扩展：统一的 Action 注册与按钮渲染；主题与布局可配置；开关与定时任务可复用。
 * 3) 零依赖：不再注入 jQuery。
 *
 * ——— 如何扩展（最重要）———
 * 1. 在 ACTIONS 中新增一个 action：
 *    {
 *      id: 'hello',              // 唯一 ID
 *      label: '打个招呼',         // 按钮文字
 *      column: 1,                // 放在第几列（1 ~ 5）
 *      handler() { alert('hi'); }
 *    }
 *
 * 2. 若想把多个按钮放到“按钮集合弹窗”，把它们的 group 指定为同一个名字：
 *    { id:'tf', label:'开逃犯', group:'开关集', handler(){ ... } }
 *    点击“开关集”主按钮时会弹出集合弹窗，里面包含同组按钮。
 *
 * 3. 定时任务：Scheduler.registerDaily('08:30', () => { ... }, 'taskKey');
 *    每天 08:30 触发；同一分钟只触发一次。
 *
 * 4. 主题：Theme.next() 可切换皮肤；Theme.apply() 应用主题到组件。
 *
 * 5. 日志：使用 Logger.log(...)；点击“隐藏日志”可隐藏/显示。
 */

/*
  变更说明（修复）：
  - GroupPopup.addButton 支持 isToggle（会显示 inset/outset）并把状态保存在 store。
  - 主按钮 openGroup(name) 改为 toggleGroup(name)，点击可切换显示/隐藏。
  - 点击 overlay（弹窗外部）也会关闭弹窗。
  - 点击组内按钮后（无论 toggle 还是普通）会收起弹窗（如需改为不收起可调整）。
*/

(function () {
    'use strict';

    /** *************************** 基础配置 ******************************** */
    const META = Object.freeze({version: '2.0.1', name: '通用网页脚本框架（重构版）'});

    const CONFIG = {
        buttonTop: 280,
        popTop: 150,
        baseLeft: 0,
        columnWidth: 70,
        columnGap: 70,
        buttonHeight: 24,
        layoutMode: 'fixed', // 'fixed' or 'auto'
        layoutOffset: 10,
        themes: [
            {name: '紫色起源', fg: '#E0EEEE', bg: '#9370DB'},
            {name: '淡绿生机', fg: '#BFEFFF', bg: '#BDB76B'},
            {name: '丰收时节', fg: '#E0EEE0', bg: '#CD661D'},
            {name: '粉色佳人', fg: '#FFFAFA', bg: '#FFB6C1'},
            {name: '黑白优雅', fg: '#111', bg: '#eee'},
            // 新增渐变色皮肤
            {name: '清新蓝绿', fg: '#ffffff', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'},
            {name: '热情夕阳', fg: '#4a2f2f', bg: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)'},
            {name: '高级紫罗兰', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'},
            {name: '极光青绿', fg: '#083b2e', bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'},
            {name: '科技未来蓝紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}
        ],
        defaultThemeIndex: 0,
        storagePrefix: 'tmx.framework.'
    };

    function getLayoutOffset(defaultOffset = 10) {
        if (CONFIG.layoutMode === 'auto') {
            const isMobile = /Android|iPhone|SymbianOS|Windows Phone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) return 10;
            const h = window.screen.height;
            if (h === 1080) return 300;
            if (h === 768) return 100;
            if (h === 720) return 50;
            if (h < 720) return 0;
            if (h > 1080) return 500;
            return defaultOffset;
        }
        return Number(CONFIG.layoutOffset) || defaultOffset;
    }

    /** *************************** 存储小工具 ******************************* */
    class Store {
        constructor(prefix) {
            this.prefix = prefix;
            this.ls = window.localStorage;
            this.ss = window.sessionStorage;
        }

        key(k) {
            return `${this.prefix}${k}`;
        }

        get(k, d = null) {
            const v = this.ls.getItem(this.key(k));
            return v == null ? d : JSON.parse(v);
        }

        set(k, v) {
            this.ls.setItem(this.key(k), JSON.stringify(v));
        }

        remove(k) {
            this.ls.removeItem(this.key(k));
        }

        sget(k, d = null) {
            const v = this.ss.getItem(this.key(k));
            return v == null ? d : JSON.parse(v);
        }

        sset(k, v) {
            this.ss.setItem(this.key(k), JSON.stringify(v));
        }

        sremove(k) {
            this.ss.removeItem(this.key(k));
        }
    }

    const store = new Store(CONFIG.storagePrefix);

    /** *************************** DOM 创建助手 ****************************** */
    const h = (tag, attrs = {}, children = []) => {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
            else if (v != null) el.setAttribute(k, String(v));
        }
        for (const child of [].concat(children)) {
            if (child == null) continue;
            el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        }
        return el;
    };

    /** *************************** 主题 ************************************* */
    const Theme = {
        index: store.get('theme.index', CONFIG.defaultThemeIndex),
        get current() {
            return CONFIG.themes[this.index % CONFIG.themes.length];
        },
        next() {
            this.setIndex((this.index + 1) % CONFIG.themes.length);
        },
        setIndex(i) {
            this.index = i;
            store.set('theme.index', i);
            this.apply();
        },
        apply() {
            document.documentElement.style.setProperty('--tmx-fg', this.current.fg);
            document.documentElement.style.setProperty('--tmx-bg', this.current.bg);
            document.documentElement.style.setProperty('--tmx-btn-h', CONFIG.buttonHeight + 'px');
        }
    };

    /** *************************** 日志（简化） ***************************** */
    const Logger = (() => {
        let el, hooked = false, orig = {log: console.log, clear: console.clear};

        function ensure() {
            if (el) return;
            el = h('div', {
                id: 'tmx-logger',
                style: {
                    position: 'fixed', left: (CONFIG.baseLeft + getLayoutOffset() + 350) + 'px',
                    top: (CONFIG.buttonTop + 3) + 'px', minWidth: '220px', maxHeight: '285px',
                    overflow: 'auto', fontFamily: 'Helvetica,Arial,sans-serif', fontSize: '12px',
                    fontWeight: 'bold', padding: '6px', background: 'var(--tmx-bg)', color: 'var(--tmx-fg)',
                    border: '1px solid #aaa', zIndex: 2147483646, opacity: 0.9
                }
            });
            document.body.appendChild(el);
        }

        function hook() {
            if (hooked) return;
            ensure();
            console.log = (...args) => {
                append(args.join(' '));
                orig.log.apply(console, args);
            };
            console.clear = () => {
                clear();
                orig.clear.apply(console);
            };
            hooked = true;
        }

        function append(text) {
            ensure();
            const row = h('div', {
                style: {
                    lineHeight: '18px',
                    background: el.children.length % 2 ? 'rgba(255,255,255,0.2)' : ''
                }
            }, text);
            el.appendChild(row);
            el.scrollTop = el.scrollHeight - el.clientHeight;
        }

        function clear() {
            if (el) el.innerHTML = '';
        }

        function hide() {
            if (el) el.style.display = 'none';
        }

        function show() {
            ensure();
            el.style.display = '';
        }

        function applyTheme() {
            if (el) {
                el.style.background = 'var(--tmx-bg)';
                el.style.color = 'var(--tmx-fg)';
            }
        }

        return {hook, append, clear, hide, show, applyTheme};
    })();

    /** *************************** 右下角弹窗 ******************************** */
    const Toast = (() => {
        let root, content, titleEl, minBtn;

        function ensure() {
            if (root) return;
            root = h('div', {
                id: 'tmx-toast',
                style: {
                    position: 'fixed',
                    right: '0',
                    bottom: '0',
                    width: '320px',
                    border: '1px solid #aaa',
                    background: '#fff',
                    zIndex: 2147483647,
                    display: 'none'
                }
            });
            const header = h('div', {
                style: {
                    height: '36px',
                    lineHeight: '36px',
                    padding: '0 8px',
                    position: 'relative',
                    color: 'var(--tmx-fg)',
                    background: 'var(--tmx-bg)',
                    borderBottom: '1px solid #aaa'
                }
            });
            titleEl = h('b', {}, '通知');
            const btns = h('span', {style: {position: 'absolute', top: '6px', right: '8px'}});
            minBtn = h('a', {href: 'javascript:void 0', style: {marginRight: '12px', textDecoration: 'none'}}, '一');
            const closeBtn = h('a', {href: 'javascript:void 0', style: {textDecoration: 'none'}}, 'X');
            btns.append(minBtn, closeBtn);
            header.append(titleEl, btns);
            content = h('div', {
                style: {
                    height: '160px',
                    width: '100%',
                    overflow: 'auto',
                    fontSize: '14px',
                    padding: '8px'
                }
            });
            root.append(header, content);
            document.body.appendChild(root);
            let expanded = true;
            minBtn.addEventListener('click', () => {
                expanded = !expanded;
                content.style.display = expanded ? '' : 'none';
            });
            closeBtn.addEventListener('click', () => root.remove());
        }

        function show(title, html) {
            ensure();
            titleEl.textContent = title || '通知';
            if (typeof html === 'string') content.innerHTML = html; else {
                content.innerHTML = '';
                content.append(html);
            }
            root.style.display = '';
        }

        function resize(hh, ww) {
            ensure();
            content.style.height = Math.max(60, hh) + 'px';
            root.style.width = Math.max(220, ww) + 'px';
        }

        function applyTheme() {
            ensure();
        }

        return {show, resize, applyTheme};
    })();

    /** *************************** 按钮列 *********************************** */
    class Columns {
        constructor() {
            this.columns = new Map();
            for (let i = 1; i <= 5; i++) this.ensure(i);
        }

        ensure(index) {
            if (this.columns.has(index)) return this.columns.get(index);
            const offset = getLayoutOffset();
            const left = CONFIG.baseLeft + offset + (index - 1) * CONFIG.columnGap;
            const box = h('div', {
                style: {
                    position: 'fixed',
                    top: CONFIG.buttonTop + 'px',
                    left: left + 'px',
                    width: CONFIG.columnWidth + 'px',
                    zIndex: 2147483646
                }
            });
            document.body.appendChild(box);
            this.columns.set(index, box);
            return box;
        }

        addButton(index, label, onClick) {
            const box = this.ensure(index);
            const btn = h('button', {style: btnStyle()}, label);
            btn.addEventListener('click', onClick);
            box.appendChild(btn);
            return btn;
        }
    }

    function btnStyle() {
        return {
            display: 'block',
            width: '100%',
            height: 'var(--tmx-btn-h)',
            marginTop: '6px',
            color: 'var(--tmx-fg)',
            background: 'var(--tmx-bg)',
            border: '1px solid #999',
            cursor: 'pointer'
        };
    }

    /** *************************** 组弹窗（支持 toggle 按钮） **************** */
    class GroupPopup {
        constructor(title) {
            this.title = title;
            // overlay covers full screen to allow click-outside-to-close
            this.overlay = h('div', {
                style: {
                    position: 'fixed',
                    inset: '0',
                    zIndex: 2147483645,
                    display: 'none',
                    background: 'rgba(0,0,0,0)'
                }
            });
            // clicking overlay (but not panel) closes
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.hide();
            });

            this.panel = h('div', {
                style: {
                    position: 'fixed',
                    top: CONFIG.popTop + 'px',
                    left: (getLayoutOffset() + 200) + 'px',
                    width: '420px',
                    padding: '10px 8px',
                    background: '#B2DFEE',
                    color: 'green',
                    textAlign: 'center',
                    border: '2px solid #ccc'
                }
            });
            const titleBar = h('div', {style: {marginBottom: '6px', fontWeight: 'bold'}}, title);
            this.btnWrap = h('div', {style: {display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center'}});
            this.panel.append(titleBar, this.btnWrap);
            this.overlay.append(this.panel);
            document.body.appendChild(this.overlay);
            this.visible = false;
        }

        /**
         * 添加按钮
         * @param {string} label
         * @param {Function} handler  // will be called either as handler(btn) for toggles or handler() for normal
         * @param {Object} options { isToggle:boolean, storeKey:string }
         */
        addButton(label, handler, options = {}) {
            const btn = h('button', {style: Object.assign({}, btnStyle(), {width: '72px'})}, label);
            // apply current theme colors
            btn.style.color = getComputedStyle(document.documentElement).getPropertyValue('--tmx-fg') || CONFIG.themes[0].fg;
            btn.style.background = getComputedStyle(document.documentElement).getPropertyValue('--tmx-bg') || CONFIG.themes[0].bg;

            if (options.isToggle && options.storeKey) {
                // read initial state from store
                let active = store.get(options.storeKey, 0) === 1;
                btn.style.borderStyle = active ? 'inset' : 'outset';
                // click toggles state, calls handler with (active, btn)
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    active = !active;
                    btn.style.borderStyle = active ? 'inset' : 'outset';
                    try {
                        handler(active, btn);
                    } catch (err) {
                        console.error(err);
                    }
                    this.hide(); // collapse after click (保持原版体验)
                });
            } else {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        handler(btn);
                    } catch (err) {
                        console.error(err);
                    }
                    this.hide();
                });
            }
            this.btnWrap.appendChild(btn);
            return btn;
        }

        show() {
            this.overlay.style.display = '';
            this.visible = true;
        }

        hide() {
            this.overlay.style.display = 'none';
            this.visible = false;
        }

        toggle() {
            this.visible ? this.hide() : this.show();
        }
    }

    /** *************************** 定时任务（保留） ************************** */
    const Scheduler = (() => {
        const dailyTasks = new Map();

        function start() {
            setInterval(() => {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const timeKey = `${hh}:${mm}`;
                const tag = `tick.${timeKey}`;
                if (store.sget(tag)) return;
                store.sset(tag, 1);
                setTimeout(() => store.sremove(tag), 65 * 1000);
                for (const [, t] of dailyTasks) {
                    if (t.time === timeKey) {
                        try {
                            t.fn();
                        } catch (err) {
                            console.error('[Scheduler]', err);
                        }
                    }
                }
            }, 10 * 1000);
        }

        function registerDaily(hhmm, fn, key) {
            dailyTasks.set(key || hhmm, {time: hhmm, fn});
        }

        function unregister(key) {
            dailyTasks.delete(key);
        }

        return {start, registerDaily, unregister};
    })();

    /** *************************** Action 注册 ******************************** */
    /**
     * 我这里把 group 内的开关（如 tf）加上额外字段 isToggle + storeKey，
     * 这样 GroupPopup.addButton 能自动读取和切换状态并显示凹陷效果。
     */
    const ACTIONS = [
        {id: 'toggle-log', label: '隐藏日志', column: 1, handler: toggleLog},
        {id: 'toggle-buttons', label: '显按钮', column: 1, handler: toggleButtons},
        {id: 'theme', label: '换皮肤', column: 2, handler: switchTheme},
        {id: 'toast', label: '弹窗提示', column: 3, handler: toggleToast},

        // 分组：开关集（kgj-open 为主按钮，用于切换弹窗）
        {id: 'kgj-open', label: '开关集', column: 5, handler: toggleGroup('开关集')},
        // 组内按钮，带 isToggle + storeKey 的会显示凹陷效果
        {
            id: 'tf',
            label: '开逃犯',
            group: '开关集',
            isToggle: true,
            storeKey: 'tf_killset',
            handler: makeToggle('tf', '开逃犯', '关逃犯', 'tf_killset')
        },
        {id: 'tj', label: '开天剑', group: '开关集', handler: noop('开天剑')},
        {id: 'bc', label: '开镖车', group: '开关集', handler: noop('开镖车')},
        {id: 'bz', label: '开帮战', group: '开关集', handler: noop('开帮战')},
        {id: 'hb', label: '开红包', group: '开关集', handler: noop('开红包')},
        {id: 'qc', label: '开抢菜', group: '开关集', handler: noop('开抢菜')},
        {id: 'dm', label: '开灯谜', group: '开关集', handler: noop('开灯谜')},
        {id: 'js', label: '开救赎', group: '开关集', handler: noop('开救赎')},
        {id: 'zx', label: '开智悬', group: '开关集', handler: noop('开智悬')},
        {id: 'zxs', label: '设智悬', group: '开关集', handler: noop('设智悬')},

        // 分组：配置集
        {id: 'cfg-open', label: '配置集', column: 4, handler: toggleGroup('配置集')},
        {
            id: 'cfg-api',
            label: '剪切板API',
            group: '配置集',
            handler: () => {
                const key = 'clipboard_api';
                const current = store.get(key, '');
                const value = prompt('请输入剪切板API:', current || '');
                if (value !== null) {
                    store.set(key, value);
                    console.log('[配置集] 已保存剪切板API:', value);
                }
            }
        },
        {
            id: 'cfg-code',
            label: '安全码',
            group: '配置集',
            handler: () => {
                const key = 'clipboard_safecode';
                const current = store.get(key, '');
                const value = prompt('请输入剪切板安全码:', current || '');
                if (value !== null) {
                    store.set(key, value);
                    console.log('[配置集] 已保存剪切板安全码:', value);
                }
            }
        },
        // 组内按钮：推送文本
        {
            id: 'cfg-push',
            label: '推送文本',
            column: 4,
            async handler() {
                const api = store.get('clipboard_api', '');
                const token = store.get('clipboard_safecode', '');
                if (!api || !token) {
                    alert('请先配置剪切板API和安全码');
                    return;
                }
                try {
                    const text = await navigator.clipboard.readText();
                    if (!text) {
                        alert('剪切板为空，无法推送');
                        return;
                    }
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: api,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        data: JSON.stringify({text}),
                        onload: function (res) {
                            console.log("✅ 请求成功！");
                            console.log("状态码:", res.status);
                            console.log("响应文本:", res.responseText);
                            console.log("响应头:", res.responseHeaders);
                            if (res.status >= 200 && res.status < 300) {
                                console.log('[推送文本] 成功:', text);
                                Logger.append(`[推送文本] 成功：${text}`);
                            } else {
                                console.error('[推送文本] 失败:', res.status, res.responseText);
                                Logger.append(`[推送文本] 失败: ${res.status}`);
                            }
                        },
                        onerror: function (err) {
                            console.error('[推送文本] 网络错误:', err);
                            Logger.append('[推送文本] 网络错误');
                        }
                    });
                } catch (err) {
                    console.error('[推送文本] 剪切板读取失败:', err);
                    Logger.append('[推送文本] 剪切板读取失败: ' + err.message);
                }
            }
        },
    ];

    /** *************************** 渲染与状态 ******************************** */
    const columns = new Columns();
    const groupMap = new Map();
    const buttonMap = new Map();

    function render() {
        // 按列渲染（独立按钮）
        for (const act of ACTIONS.filter(a => a.column)) {
            const btn = columns.addButton(act.column, act.label, () => act.handler(buttonMap.get(act.id) || null));
            buttonMap.set(act.id, btn);
        }

        // 分组渲染：先采集组
        const groups = ACTIONS.filter(a => a.group).reduce((acc, a) => {
            (acc[a.group] = acc[a.group] || []).push(a);
            return acc;
        }, {});
        for (const [name, acts] of Object.entries(groups)) {
            const gp = new GroupPopup(name);
            groupMap.set(name, gp);
            for (const a of acts) {
                // 把 isToggle / storeKey 转交给 gp.addButton
                gp.addButton(a.label, a.handler, {isToggle: !!a.isToggle, storeKey: a.storeKey});
            }
        }
    }

    /** -------------------- 独立按钮行为 -------------------- */
    function toggleLog() {
        const hidden = document.getElementById('tmx-logger')?.style.display === 'none';
        if (hidden) {
            Logger.show();
        } else {
            Logger.hide();
        }
    }

    function toggleButtons() {
        // 把除了本身（显按钮）之外的所有按钮切换可见性
        const btn = buttonMap.get('toggle-buttons');
        const nowHidden = Array.from(buttonMap.values()).some(b => b.style.visibility === 'hidden');
        for (const [id, el] of buttonMap) {
            if (id === 'toggle-buttons') continue;
            el.style.visibility = nowHidden ? 'visible' : 'hidden';
        }
        if (btn) btn.textContent = nowHidden ? '隐按钮' : '显按钮';
    }

    function switchTheme() {
        Theme.next();
        Theme.apply();
        Logger.applyTheme();
        Toast.applyTheme();
        // 同步按钮颜色
        for (const [, el] of buttonMap) {
            el.style.color = 'var(--tmx-fg)';
            el.style.background = 'var(--tmx-bg)';
        }
        for (const [, gp] of groupMap) {
            Array.from(gp.btnWrap.children).forEach(b => {
                b.style.color = 'var(--tmx-fg)';
                b.style.background = 'var(--tmx-bg)';
            });
        }
        console.log(`当前皮肤为 -- ${Theme.current.name}`);
    }

    function toggleToast() {
        const flag = store.sget('toast.enabled', 0) ? 0 : 1;
        store.sset('toast.enabled', flag);
        const btn = buttonMap.get('toast');
        if (btn) {
            btn.style.borderStyle = flag ? 'inset' : 'outset';
            btn.textContent = flag ? '关闭弹窗' : '弹窗提示';
        }
        if (flag) Toast.show('提示', '<b>你好</b>');
    }

    /** -------------------- 组控制 -------------------- */
    function toggleGroup(name) {
        return (btnEl) => {
            const gp = groupMap.get(name);
            if (!gp) return;
            gp.toggle();
            // 可选：当弹窗显示时，让主按钮有一个视觉效果
            if (btnEl) btnEl.style.borderStyle = gp.visible ? 'inset' : 'outset';
        };
    }

    /** -------------------- makeToggle（返回 handler） -------------------- */
    function makeToggle(id, openLabel, closeLabel, storeKey) {
        return (activeOrBtn, maybeBtn) => {
            // 兼容两种调用方式：
            // 1) group popup calls handler(active, btn) -> active is boolean, maybeBtn is btn
            // 2) column button calls handler(btn) -> activeOrBtn is btn
            if (typeof activeOrBtn === 'boolean') {
                const active = activeOrBtn;
                const btn = maybeBtn;
                // save to store
                store.set(storeKey, active ? 1 : 0);
                // update text if btn provided
                if (btn) btn.innerText = active ? closeLabel : openLabel;
                console.log(`[${openLabel}] 状态：${active ? '已开启' : '已关闭'}`);
            } else {
                // called as handler(btn) from column (rare for these toggles) - just toggle state
                const btn = activeOrBtn;
                const cur = store.get(storeKey, 0) === 1;
                const will = !cur;
                store.set(storeKey, will ? 1 : 0);
                if (btn) {
                    btn.innerText = will ? closeLabel : openLabel;
                    btn.style.borderStyle = will ? 'inset' : 'outset';
                }
                console.log(`[${openLabel}] 状态：${will ? '已开启' : '已关闭'}`);
            }
        };
    }

    function noop(name) {
        return () => console.log(`[${name}] 点击`);
    }

    /** *************************** 初始化 *********************************** */
    function init() {
        Theme.apply();
        Logger.hook();
        Logger.append(`${META.name}: v${META.version}`);
        Logger.append(`布局偏移：${getLayoutOffset()}`);

        render();

        // 初始：同步 toast 按钮状态（如果存在）
        const toastOn = store.sget('toast.enabled', 0) === 1;
        const toastBtn = buttonMap.get('toast');
        if (toastBtn) {
            toastBtn.textContent = toastOn ? '关闭弹窗' : '弹窗提示';
            toastBtn.style.borderStyle = toastOn ? 'inset' : 'outset';
        }
        if (toastOn) Toast.show('提示', '你好');

        // 给组内的 toggle 按钮同步初始样式（因为 gp.addButton 已处理，这里确保若你需要同步主按钮的样式也可）
        const kgjBtn = buttonMap.get('kgj-open');
        const gp = groupMap.get('开关集');
        if (kgjBtn && gp) {
            kgjBtn.style.borderStyle = gp.visible ? 'inset' : 'outset';
        }

        Scheduler.registerDaily('12:00', () => console.log('执行定时任务：12:00'), 'demo.noon');
        Scheduler.start();

        const now = new Date().toLocaleString();
        console.log(`上次网页刷新时间：${now}`);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
