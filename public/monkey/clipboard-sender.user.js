// ==UserScript==
// @name         通用网页脚本框架（重构版）
// @namespace    https://github.com/hjdhnx/drpy-node
// @description  日志、右下角弹窗、按钮皮肤、可配置布局、按钮集合弹窗、按钮开关、定时任务等；结构化、可扩展。
// @version      2.0.2
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
    const META = Object.freeze({version: '3.0.5', name: '通用网页脚本框架（重构版-v3.0.5）'});

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
            {name: '科技未来蓝紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'},
            // 新增更多渐变色皮肤
            {name: '日落金橙', fg: '#ffffff', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'},
            {name: '薄荷清凉', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'},
            {name: '浪漫粉紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)'},
            {name: '深海蓝', fg: '#ffffff', bg: 'linear-gradient(135deg, #0c2b5b 0%, #204584 100%)'},
            {name: '森林绿意', fg: '#ffffff', bg: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)'},
            {name: '莓果甜心', fg: '#ffffff', bg: 'linear-gradient(135deg, #c71d6f 0%, #d09693 100%)'},
            {name: '柠檬青柚', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)'},
            {name: '星空紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #231557 0%, #44107a 29%, #ff1361 67%, #fff800 100%)'},
            {name: '珊瑚橙红', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)'},
            {name: '冰川蓝白', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)'},
            // 新增现代感皮肤
            {name: '赛博朋克', fg: '#00ffff', bg: 'linear-gradient(135deg, #0f0f23 0%, #2d1b69 50%, #ff006e 100%)'},
            {name: '霓虹夜色', fg: '#ffffff', bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #e94560 100%)'},
            {name: '极简黑金', fg: '#ffd700', bg: 'linear-gradient(135deg, #000000 0%, #434343 100%)'},
            {name: '银河星尘', fg: '#ffffff', bg: 'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #9b59b6 100%)'},
            {name: '电光蓝紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'},
            {name: '炫彩极光', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff0844 0%, #ffb199 25%, #00d4ff 50%, #90e0ef 75%, #a8dadc 100%)'},
            {name: '暗黑科技', fg: '#00ff41', bg: 'linear-gradient(135deg, #0d1421 0%, #1a252f 50%, #2a3441 100%)'},
            {name: '彩虹渐变', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff0000 0%, #ff8000 16.66%, #ffff00 33.33%, #80ff00 50%, #00ff80 66.66%, #0080ff 83.33%, #8000ff 100%)'},
            // 新增自然风皮肤
            {name: '樱花飞舞', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)'},
            {name: '秋叶满山', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ff6b6b 100%)'},
            {name: '海洋深处', fg: '#ffffff', bg: 'linear-gradient(135deg, #667db6 0%, #0082c8 50%, #0052d4 100%)'},
            {name: '翡翠森林', fg: '#ffffff', bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'},
            {name: '薰衣草田', fg: '#ffffff', bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'},
            // 新增艺术感皮肤
            {name: '油画印象', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 30%, #ff9a9e 60%, #fecfef 100%)'},
            {name: '水彩渲染', fg: '#ffffff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)'},
            {name: '抽象几何', fg: '#ffffff', bg: 'linear-gradient(45deg, #ff6b6b 0%, #4ecdc4 25%, #45b7d1 50%, #96ceb4 75%, #ffeaa7 100%)'},
            {name: '梦幻极光', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 25%, #d299c2 50%, #fef9d7 75%, #dae2f8 100%)'},
            {name: '水墨丹青', fg: '#ffffff', bg: 'linear-gradient(135deg, #2c3e50 0%, #34495e 30%, #7f8c8d 60%, #95a5a6 100%)'},
            {name: '火焰燃烧', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff4e50 0%, #f9ca24 50%, #ff6348 100%)'},
            {name: '冰雪奇缘', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 25%, #90caf9 50%, #64b5f6 75%, #42a5f5 100%)'},
            {name: '紫罗兰梦', fg: '#ffffff', bg: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 25%, #af7ac5 50%, #c39bd3 75%, #d7bde2 100%)'},
            // 新增经典配色
            {name: '复古胶片', fg: '#f4f4f4', bg: 'linear-gradient(135deg, #8b5a3c 0%, #d4a574 50%, #f4e4bc 100%)'},
            {name: '工业风格', fg: '#ffffff', bg: 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #95a5a6 100%)'},
            {name: '马卡龙色', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 25%, #fd79a8 50%, #a29bfe 75%, #74b9ff 100%)'},
            {name: '暗夜精灵', fg: '#00d4aa', bg: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #2d2d2d 100%)'},
            // 新增时尚潮流皮肤
            {name: '玫瑰金辉', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #f8cdda 0%, #1d2b64 100%)'},
            {name: '翡翠绿洲', fg: '#ffffff', bg: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)'},
            {name: '琥珀夕照', fg: '#ffffff', bg: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)'},
            {name: '深邃蓝海', fg: '#ffffff', bg: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'},
            {name: '紫晶魅惑', fg: '#ffffff', bg: 'linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)'},
            {name: '橙红烈焰', fg: '#ffffff', bg: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)'},
            {name: '青春活力', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)'},
            {name: '梦幻粉紫', fg: '#ffffff', bg: 'linear-gradient(135deg, #cc2b5e 0%, #753a88 100%)'},
            {name: '金属质感', fg: '#ffffff', bg: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)'},
            {name: '炫酷黑红', fg: '#ffffff', bg: 'linear-gradient(135deg, #000000 0%, #e74c3c 100%)'},
            // 新增自然风光皮肤
            {name: '晨曦微光', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'},
            {name: '暮色苍茫', fg: '#ffffff', bg: 'linear-gradient(135deg, #2c3e50 0%, #fd746c 100%)'},
            {name: '春意盎然', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%)'},
            {name: '秋韵浓浓', fg: '#ffffff', bg: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)'},
            {name: '冬雪皑皑', fg: '#2d2d2d', bg: 'linear-gradient(135deg, #e6ddd4 0%, #d5def5 100%)'},
            {name: '夏日清凉', fg: '#ffffff', bg: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)'},
            // 新增科幻未来皮肤
            {name: '星际穿越', fg: '#ffffff', bg: 'linear-gradient(135deg, #0f0f23 0%, #8e44ad 50%, #3498db 100%)'},
            {name: '量子空间', fg: '#00ffff', bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'},
            {name: '机械战警', fg: '#ffffff', bg: 'linear-gradient(135deg, #434343 0%, #000000 50%, #ff6b6b 100%)'},
            {name: '虚拟现实', fg: '#ffffff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'},
            {name: '时空隧道', fg: '#ffffff', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #43e97b 100%)'},
            // 新增奢华典雅皮肤
            {name: '皇室紫金', fg: '#ffd700', bg: 'linear-gradient(135deg, #2c1810 0%, #8e44ad 50%, #f39c12 100%)'},
            {name: '贵族蓝银', fg: '#ffffff', bg: 'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #ecf0f1 100%)'},
            {name: '典雅黑白', fg: '#ffffff', bg: 'linear-gradient(135deg, #000000 0%, #434343 50%, #ffffff 100%)'},
            {name: '奢华红金', fg: '#ffd700', bg: 'linear-gradient(135deg, #8b0000 0%, #dc143c 50%, #ffd700 100%)'},
            {name: '翡翠宝石', fg: '#ffffff', bg: 'linear-gradient(135deg, #134e5e 0%, #71b280 50%, #a8e6cf 100%)'},
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
                    top: (CONFIG.buttonTop + 3) + 'px', minWidth: '220px', maxWidth: '400px', maxHeight: '285px',
                    overflow: 'auto', fontFamily: 'Helvetica,Arial,sans-serif', fontSize: '12px',
                    fontWeight: 'bold', padding: '6px', background: 'var(--tmx-bg)', color: 'var(--tmx-fg)',
                    border: '1px solid #aaa', zIndex: 2147483646, opacity: 0.9,
                    wordWrap: 'break-word', whiteSpace: 'pre-wrap'
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
                    width: '300px',
                    border: '1px solid #aaa',
                    background: '#fff',
                    zIndex: 2147483645,
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
            const closeBtn = h('a', {
                href: 'javascript:void 0', 
                style: {
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                }
            }, '×');
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
                if (expanded) {
                    // 展开状态：恢复到右下角
                    content.style.display = '';
                    header.style.display = '';
                    root.style.right = '0';
                    root.style.bottom = '0';
                    root.style.width = '300px';
                    root.style.height = '';
                    root.style.padding = '';
                    root.style.borderRadius = '';
                    root.style.boxShadow = '';
                    root.style.fontSize = '';
                    root.style.display = '';       // 恢复默认display
                    root.style.justifyContent = ''; // 清除flex属性
                    root.style.alignItems = '';    // 清除flex属性
                    root.style.boxSizing = '';
                    // 清空最小化内容
                    if (root.minimizedContent) {
                        root.minimizedContent.remove();
                        root.minimizedContent = null;
                    }
                } else {
                    // 最小化状态：固定在最右下角，样式与调试窗口一致
                    content.style.display = 'none';
                    header.style.display = 'none';
                    root.style.right = '10px';
                    root.style.bottom = '10px';  // 往下移动，避免被调试窗口遮挡
                    root.style.width = '120px';  // 设置固定宽度
                    root.style.height = '32px';  // 设置固定高度
                    root.style.padding = '8px 12px';  // 与调试窗口最小化项一致
                    root.style.borderRadius = '4px';  // 与调试窗口最小化项一致
                    root.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'; // 与调试窗口最小化项一致
                    root.style.fontSize = '12px';     // 与调试窗口最小化项一致
                    root.style.background = 'var(--tmx-bg)';  // 添加背景颜色，与全局皮肤色保持一致
                    root.style.color = 'var(--tmx-fg)';      // 添加文字颜色
                    root.style.display = 'flex';      // 使用flex布局
                    root.style.justifyContent = 'space-between'; // 与调试窗口布局一致
                    root.style.alignItems = 'center'; // 垂直居中
                    root.style.boxSizing = 'border-box'; // 确保padding包含在尺寸内
                    root.style.cursor = 'pointer';
                    
                    // 创建最小化内容
                    const minimizedTitle = h('span', {}, titleEl.textContent);
                    const minimizedCloseBtn = h('span', {
                        style: {
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        },
                        onclick: (e) => {
                            e.stopPropagation();
                            root.remove();
                        }
                    }, '×');
                    
                    root.minimizedContent = h('div', {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%'
                        }
                    });
                    root.minimizedContent.appendChild(minimizedTitle);
                    root.minimizedContent.appendChild(minimizedCloseBtn);
                    root.appendChild(root.minimizedContent);
                }
            });
            
            // 点击最小化状态时展开
            root.addEventListener('click', (e) => {
                if (!expanded && e.target === root) {
                    minBtn.click();
                }
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
        {id: 'debug', label: '调试执行', column: 2, handler: executeDebugCode},

        // 分组：开关集（kgj-open 为主按钮，用于切换弹窗）
        {id: 'kgj-open', label: '开关集', column: 5, handler: toggleGroup('开关集')},
        // 皮肤集按钮
        {id: 'skin-open', label: '皮肤集', column: 5, handler: toggleSkinSelector},
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
        {id: 'cfg-api',
            label: '剪切板API',
            group: '配置集',
            handler: configClipboardApi
        },
        {id: 'cfg-code',
            label: '安全码',
            group: '配置集',
            handler: configSafeCode
        },
        // 组内按钮：推送文本
        {id: 'cfg-push',
            label: '推送文本',
            column: 4,
            handler: pushClipboardText
        },
    ];

    /** *************************** 渲染与状态 ******************************** */
    const columns = new Columns();
    const groupMap = new Map();
    const buttonMap = new Map();

    function render() {
        // 按列渲染（独立按钮）
        for (const act of ACTIONS.filter(a => a.column)) {
            const btn = columns.addButton(act.column, act.label, () => act.handler());
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
        // 使用store中的状态作为主要判断依据，DOM状态作为备用
        const storedHidden = store.get('logger.hidden', 0) === 1;
        const domHidden = document.getElementById('tmx-logger')?.style.display === 'none';
        const isCurrentlyHidden = storedHidden || domHidden;
        
        if (isCurrentlyHidden) {
            Logger.show();
            store.set('logger.hidden', 0);
            const btn = buttonMap.get('toggle-log');
            if (btn) {
                btn.textContent = '隐藏日志';
                btn.style.borderStyle = 'inset';
            }
        } else {
            Logger.hide();
            store.set('logger.hidden', 1);
            const btn = buttonMap.get('toggle-log');
            if (btn) {
                btn.textContent = '显示日志';
                btn.style.borderStyle = 'outset';
            }
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
        if (btn) {
            btn.textContent = nowHidden ? '隐按钮' : '显按钮';
            btn.style.borderStyle = nowHidden ? 'inset' : 'outset';
        }
        store.set('buttons.hidden', nowHidden ? 0 : 1);
    }

    function switchTheme() {
        Theme.next();
        Theme.apply();
        Logger.applyTheme();
        Toast.applyTheme();
        Dialog.applyTheme();
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

    /** *************************** 皮肤选择器 ******************************** */
    class SkinSelector {
        constructor() {
            this.overlay = h('div', {
                style: {
                    position: 'fixed',
                    inset: '0',
                    zIndex: 2147483647,
                    display: 'none',
                    background: 'rgba(0,0,0,0.3)'
                }
            });
            
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.hide();
            });

            this.panel = h('div', {
                style: {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    maxHeight: '500px',
                    padding: '20px',
                    background: 'var(--tmx-bg)',
                    color: 'var(--tmx-fg)',
                    border: '2px solid #ccc',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    overflow: 'auto'
                }
            });

            const titleBar = h('div', {
                style: {
                    marginBottom: '15px',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    textAlign: 'center',
                    borderBottom: '1px solid #ccc',
                    paddingBottom: '10px'
                }
            }, '选择皮肤主题');

            this.skinGrid = h('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '10px',
                    marginBottom: '15px'
                }
            });

            this.closeBtn = h('button', {
                style: {
                    position: 'absolute',
                    top: '10px',
                    right: '15px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: 'var(--tmx-fg)',
                    fontWeight: 'bold'
                }
            }, '×');
            
            this.closeBtn.addEventListener('click', () => this.hide());

            this.panel.append(titleBar, this.skinGrid, this.closeBtn);
            this.overlay.append(this.panel);
            document.body.appendChild(this.overlay);
            
            this.createSkinButtons();
            this.visible = false;
        }

        createSkinButtons() {
            CONFIG.themes.forEach((theme, index) => {
                const skinBtn = h('div', {
                    style: {
                        padding: '12px',
                        border: '2px solid #ccc',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: theme.bg,
                        color: theme.fg,
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        minHeight: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                }, theme.name);

                // 当前选中的皮肤添加特殊标识
                if (index === Theme.index) {
                    skinBtn.style.borderColor = '#007bff';
                    skinBtn.style.borderWidth = '3px';
                    skinBtn.style.boxShadow = '0 0 10px rgba(0,123,255,0.5)';
                }

                skinBtn.addEventListener('mouseenter', () => {
                    if (index !== Theme.index) {
                        skinBtn.style.transform = 'scale(1.05)';
                        skinBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                    }
                });

                skinBtn.addEventListener('mouseleave', () => {
                    if (index !== Theme.index) {
                        skinBtn.style.transform = 'scale(1)';
                        skinBtn.style.boxShadow = 'none';
                    }
                });

                skinBtn.addEventListener('click', () => {
                    // 移除之前选中的样式
                    this.skinGrid.querySelectorAll('div').forEach(btn => {
                        btn.style.borderColor = '#ccc';
                        btn.style.borderWidth = '2px';
                        btn.style.boxShadow = 'none';
                    });
                    
                    // 应用新皮肤
                    Theme.index = index;
                    Theme.apply();
                    Logger.applyTheme();
                    Toast.applyTheme();
                    Dialog.applyTheme();
                    
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
                    
                    // 更新弹窗样式
                    this.panel.style.background = 'var(--tmx-bg)';
                    this.panel.style.color = 'var(--tmx-fg)';
                    this.closeBtn.style.color = 'var(--tmx-fg)';
                    
                    // 标记当前选中
                    skinBtn.style.borderColor = '#007bff';
                    skinBtn.style.borderWidth = '3px';
                    skinBtn.style.boxShadow = '0 0 10px rgba(0,123,255,0.5)';
                    
                    console.log(`已切换到皮肤: ${theme.name}`);
                    
                    // 延迟关闭弹窗
                    setTimeout(() => this.hide(), 300);
                });

                this.skinGrid.appendChild(skinBtn);
            });
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

    // 创建全局皮肤选择器实例
    let skinSelector = null;

    function toggleSkinSelector(btnEl) {
        if (!skinSelector) {
            skinSelector = new SkinSelector();
        }
        skinSelector.toggle();
        if (btnEl) {
            btnEl.style.borderStyle = skinSelector.visible ? 'inset' : 'outset';
        }
    }

    function toggleToast() {
        const flag = store.get('toast.enabled', 0) ? 0 : 1;
        store.set('toast.enabled', flag);
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

    /** -------------------- 配置集按钮行为 -------------------- */
    async function configClipboardApi() {
        try {
            const key = 'clipboard_api';
            const current = store.get(key, '');
            console.log('Dialog: 准备显示prompt对话框');
            const value = await Dialog.prompt('请输入剪切板API:', current || '', '配置剪切板API');
            console.log('Dialog: prompt对话框返回值:', value);
            if (value !== null) {
                store.set(key, value);
                console.log('[配置集] 已保存剪切板API:', value);
            }
        } catch (err) {
            console.error('Dialog错误:', err);
        }
    }

    /** -------------------- 调试功能 -------------------- */
    function executeDebugCode() {
        // 创建新的调试代码窗口
        const defaultCode = '// 示例代码\nconsole.log("Hello World!");\nalert("测试弹窗");\n\n// 获取页面元素\nconst elements = document.querySelectorAll("div");\nconsole.log("页面div元素数量:", elements.length);';
        
        const windowId = DebugWindowManager.createWindow(defaultCode);
        console.log(`[调试执行器] 创建调试窗口: ${windowId}`);
        Logger.append(`[调试执行器] 创建新调试窗口: ${windowId}`);
    }

    async function configSafeCode() {
        const key = 'clipboard_safecode';
        const current = store.get(key, '');
        const value = await Dialog.prompt('请输入剪切板安全码:', current || '', '配置安全码');
        if (value !== null) {
            store.set(key, value);
            console.log('[配置集] 已保存剪切板安全码:', value);
        }
    }

    // 检查文本是否包含可疑模式
    function containsSuspiciousPatterns(text) {
        const suspiciousPatterns = [
            /\x4D\x5A/, // MZ (可执行文件头)
            /\x7F\x45\x4C\x46/, // ELF (Linux可执行文件)
            /\x23\x21/, // Shebang (#!)
            /<\?php/i, // PHP代码
            /<script\b[^>]*>/i, // Script标签
            /eval\(/i, // eval函数
            /javascript:/i, // javascript协议
            /vbscript:/i, // vbscript协议
        ];
        return suspiciousPatterns.some(pattern => pattern.test(text));
    }

    async function pushClipboardText() {
        const api = store.get('clipboard_api', '');
        const token = store.get('clipboard_safecode', '');
        if (!api || !token) {
            await Dialog.alert('请先配置剪切板API和安全码', '推送失败');
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                await Dialog.alert('剪切板为空，无法推送', '推送失败');
                return;
            }
            
            // 检查是否包含可疑内容
            if (containsSuspiciousPatterns(text)) {
                const confirmed = await Dialog.confirm(
                    '检测到剪切板内容包含可疑模式（如脚本代码、可执行文件等），可能存在安全风险。\n\n是否仍要继续推送？',
                    '安全警告'
                );
                if (!confirmed) {
                    Logger.append('[推送文本] 用户取消：内容包含可疑模式');
                    return;
                }
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
                        Logger.append(`[推送文本] 失败: ${res.status} ${res.responseText}`);
                        
                        // 特殊处理可疑内容错误
                        if (res.status === 400 && res.responseText.includes('suspicious patterns')) {
                            Dialog.alert('服务器检测到内容包含可疑模式，推送被拒绝。\n\n请检查剪切板内容是否包含脚本代码、可执行文件等敏感内容。', '推送失败');
                        }
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
            await Dialog.alert(`剪切板读取失败: ${err.message}`, '推送失败');
        }
    }

    /** *************************** 自定义对话框 *********************************** */
const Dialog = (() => {
    let overlay, panel, titleEl, contentEl, inputEl, buttonArea;
    let resolvePromise = null;
    
    function ensure() {
        return new Promise((resolve) => {
            console.log('Dialog ensure: checking elements', { overlay: !!overlay, titleEl: !!titleEl, contentEl: !!contentEl, buttonArea: !!buttonArea });
            // 检查所有必要的DOM元素是否都已创建
            if (overlay && titleEl && contentEl && buttonArea) {
                console.log('Dialog ensure: all elements exist, resolving');
                resolve();
                return;
            }
            
            // 确保document.body已经存在
            if (!document.body) {
                console.error('Dialog: document.body not ready');
                setTimeout(() => ensure().then(resolve), 100);
                return;
            }
            
            console.log('Dialog ensure: initializing dialog');
            initializeDialog();
            console.log('Dialog ensure: after init', { overlay: !!overlay, titleEl: !!titleEl, contentEl: !!contentEl, buttonArea: !!buttonArea });
            resolve();
        });
    }
    
    function initializeDialog() {
        
        // 创建遮罩层
        overlay = h('div', {
            style: {
                position: 'fixed',
                inset: '0',
                zIndex: 2147483647,
                display: 'none',
                background: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center'
            }
        });
        
        // 创建对话框面板
        panel = h('div', {
            style: {
                width: '320px',
                background: '#fff',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                fontFamily: 'Arial, sans-serif'
            }
        });
        
        // 标题栏
        const header = h('div', {
            style: {
                padding: '10px 15px',
                borderBottom: '1px solid #eee',
                background: 'var(--tmx-bg)',
                color: 'var(--tmx-fg)',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        });
        
        titleEl = h('span', {}, '对话框');
        
        // 右上角关闭按钮
        const closeButton = h('button', {
            style: {
                background: 'none',
                border: 'none',
                color: 'var(--tmx-fg)',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '2px'
            },
            onclick: () => hide(null)
        }, '×');
        
        // 鼠标悬停效果
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(255,255,255,0.2)';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'none';
        });
        
        header.appendChild(titleEl);
        header.appendChild(closeButton);
        
        // 内容区域
        contentEl = h('div', {
            style: {
                padding: '15px',
                minHeight: '50px',
                maxHeight: '300px',
                overflow: 'auto'
            }
        });
        
        // 输入框区域（用于prompt）
        inputEl = h('input', {
            type: 'text',
            style: {
                display: 'none',
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginTop: '10px',
                boxSizing: 'border-box'
            }
        });
        contentEl.appendChild(inputEl);
        
        // 按钮区域
        buttonArea = h('div', {
            style: {
                padding: '10px 15px',
                borderTop: '1px solid #eee',
                textAlign: 'right'
            }
        });
        
        panel.append(header, contentEl, buttonArea);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        
        // 添加调试日志
        console.log('Dialog: DOM elements created and appended to body');
    }
    
    function createButton(text, isPrimary = false, onClick) {
        return h('button', {
            style: {
                padding: '6px 12px',
                marginLeft: '8px',
                background: isPrimary ? 'var(--tmx-bg)' : '#f8f9fa',
                color: isPrimary ? 'var(--tmx-fg)' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
            },
            onclick: onClick
        }, text);
    }
    
    async function show(title, content, options = {}) {
        await ensure();
        console.log('Dialog show: titleEl =', titleEl);
        if (!titleEl) {
            console.error('Dialog show: titleEl is still undefined after ensure()');
            return;
        }
        titleEl.textContent = title || '提示';
        
        // 清理旧内容
        const oldContent = contentEl.querySelectorAll(':not(input)');
        oldContent.forEach(el => el.remove());
        
        // 设置内容
        if (typeof content === 'string') {
            const contentNode = document.createElement('div');
            contentNode.innerHTML = content;
            contentEl.insertBefore(contentNode, inputEl);
        } else {
            contentEl.insertBefore(content, inputEl);
        }
        
        // 处理输入框
        inputEl.style.display = options.showInput ? 'block' : 'none';
        inputEl.value = options.defaultValue || '';
        if (options.showInput) {
            setTimeout(() => inputEl.focus(), 100);
        }
        
        // 清空并添加按钮
        buttonArea.innerHTML = '';
        if (options.buttons) {
            options.buttons.forEach(btn => {
                buttonArea.appendChild(btn);
            });
        }
        
        // 显示对话框
        overlay.style.display = 'flex';
        
        // 返回Promise
        return new Promise(resolve => {
            resolvePromise = resolve;
        });
    }
    
    function hide(result) {
        if (overlay) {
            overlay.style.display = 'none';
            // 清理内容
            const oldContent = contentEl.querySelectorAll(':not(input)');
            oldContent.forEach(el => el.remove());
            inputEl.style.display = 'none';
            inputEl.value = '';
            buttonArea.innerHTML = '';
        }
        if (resolvePromise) {
            resolvePromise(result);
            resolvePromise = null;
        }
    }
    
    function alert(message, title = '提示') {
        const okButton = createButton('确定', true, () => hide(true));
        return show(title, message, {
            buttons: [okButton]
        });
    }
    
    function confirm(message, title = '确认') {
        const cancelButton = createButton('取消', false, () => hide(false));
        const okButton = createButton('确定', true, () => hide(true));
        return show(title, message, {
            buttons: [cancelButton, okButton]
        });
    }
    
    function prompt(message, defaultValue = '', title = '输入') {
        const cancelButton = createButton('取消', false, () => hide(null));
        const okButton = createButton('确定', true, () => hide(inputEl.value));
        return show(title, message, {
            showInput: true,
            defaultValue: defaultValue,
            buttons: [cancelButton, okButton]
        });
    }
    
    async function multilinePrompt(message, defaultValue = '', title = '多行输入', options = {}) {
        await ensure();
        titleEl.textContent = title || '多行输入';
        
        // 清理旧内容
        const oldContent = contentEl.querySelectorAll(':not(input)');
        oldContent.forEach(el => el.remove());
        
        // 设置内容
        if (typeof message === 'string') {
            const contentNode = document.createElement('div');
            contentNode.innerHTML = message;
            contentEl.insertBefore(contentNode, inputEl);
        } else {
            contentEl.insertBefore(message, inputEl);
        }
        
        // 创建多行文本输入框
        const textareaEl = h('textarea', {
            style: {
                width: options.width || '100%',
                height: options.height || '200px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginTop: '10px',
                boxSizing: 'border-box',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '12px',
                lineHeight: '1.4',
                resize: 'both',
                minHeight: '100px',
                maxHeight: '400px'
            },
            placeholder: options.placeholder || '请输入代码...'
        });
        textareaEl.value = defaultValue || '';
        contentEl.insertBefore(textareaEl, inputEl);
        
        // 隐藏原输入框
        inputEl.style.display = 'none';
        
        // 调整对话框大小
        panel.style.width = options.dialogWidth || '600px';
        panel.style.maxWidth = '90vw';
        
        // 创建按钮
        const cancelButton = createButton('取消', false, () => {
            panel.style.width = '320px'; // 恢复默认宽度
            hide(null);
        });
        const okButton = createButton('确定', true, () => {
            const value = textareaEl.value;
            panel.style.width = '320px'; // 恢复默认宽度
            hide(value);
        });
        
        // 清空并添加按钮
        buttonArea.innerHTML = '';
        buttonArea.appendChild(cancelButton);
        buttonArea.appendChild(okButton);
        
        // 显示对话框
        overlay.style.display = 'flex';
        
        // 聚焦到文本框
        setTimeout(() => textareaEl.focus(), 100);
        
        // 返回Promise
        return new Promise(resolve => {
            resolvePromise = resolve;
        });
    }
    
    function applyTheme() {
        if (!panel || !buttonArea) return;
        const header = panel.querySelector('div');
        if (header) {
            header.style.background = 'var(--tmx-bg)';
            header.style.color = 'var(--tmx-fg)';
        }
        
        const primaryButtons = buttonArea.querySelectorAll('button');
        primaryButtons.forEach((btn, index) => {
            if (index === primaryButtons.length - 1) { // 主按钮通常是最后一个
                btn.style.background = 'var(--tmx-bg)';
                btn.style.color = 'var(--tmx-fg)';
            }
        });
    }
    
    // 初始化函数，确保DOM元素已创建
    function initialize() {
        // 确保DOM元素已创建
        ensure();
        console.log('Dialog: 初始化完成');
    }
    
    return { alert, confirm, prompt, multilinePrompt, applyTheme, initialize };
})();

/** *************************** 调试代码窗口管理器 *********************************** */
const DebugWindowManager = (() => {
    let windowCounter = 0;
    const activeWindows = new Map();
    const minimizedWindows = new Map();
    let minimizedContainer = null;
    
    function createMinimizedContainer() {
        if (minimizedContainer) return;
        
        // 计算Toast弹窗的高度，为调试窗口留出空间
        const toastHeight = 50; // Toast最小化后的大概高度
        const bottomOffset = 10 + toastHeight + 10; // Toast高度 + 间距
        
        minimizedContainer = h('div', {
            style: {
                position: 'fixed',
                bottom: bottomOffset + 'px',
                right: '10px',
                zIndex: 2147483646,
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                maxWidth: '300px'
            }
        });
        
        document.body.appendChild(minimizedContainer);
    }
    
    function createDebugWindow(defaultCode = '') {
        windowCounter++;
        const windowId = `debug-window-${windowCounter}`;
        
        // 创建窗口遮罩
        const overlay = h('div', {
            style: {
                position: 'fixed',
                inset: '0',
                zIndex: 2147483647,
                display: 'flex',
                background: 'rgba(0,0,0,0.3)',
                alignItems: 'center',
                justifyContent: 'center'
            }
        });
        
        // 创建窗口面板
        const panel = h('div', {
            style: {
                width: '700px',
                maxWidth: '90vw',
                background: '#fff',
                borderRadius: '6px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                fontFamily: 'Arial, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '80vh'
            }
        });
        
        // 标题栏
        const header = h('div', {
            style: {
                padding: '10px 15px',
                borderBottom: '1px solid #eee',
                background: 'var(--tmx-bg)',
                color: 'var(--tmx-fg)',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        });
        
        const titleEl = h('span', {}, `调试代码 #${windowCounter}`);
        
        // 窗口控制按钮容器
        const controlButtons = h('div', {
            style: {
                display: 'flex',
                gap: '5px'
            }
        });
        
        // 最小化按钮
        const minimizeButton = h('button', {
            style: {
                background: 'none',
                border: 'none',
                color: 'var(--tmx-fg)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '2px',
                lineHeight: '1'
            },
            onclick: () => minimizeWindow(windowId)
        }, '−');
        
        // 关闭按钮
        const closeButton = h('button', {
            style: {
                background: 'none',
                border: 'none',
                color: 'var(--tmx-fg)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '2px',
                lineHeight: '1'
            },
            onclick: () => closeWindow(windowId)
        }, '×');
        
        // 按钮悬停效果
        [minimizeButton, closeButton].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,255,255,0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'none';
            });
        });
        
        controlButtons.appendChild(minimizeButton);
        controlButtons.appendChild(closeButton);
        header.appendChild(titleEl);
        header.appendChild(controlButtons);
        
        // 添加拖动功能
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        // 设置标题栏样式支持拖动
        header.style.cursor = 'move';
        header.style.userSelect = 'none';
        
        header.addEventListener('mousedown', (e) => {
            // 只有点击标题区域才能拖动，避免点击按钮时触发拖动
            if (e.target === header || e.target === titleEl) {
                isDragging = true;
                const rect = panel.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                
                // 防止文本选择
                e.preventDefault();
                
                // 添加全局鼠标事件
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        });
        
        function handleMouseMove(e) {
            if (!isDragging) return;
            
            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;
            
            // 限制窗口不超出视窗边界
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            
            const constrainedX = Math.max(0, Math.min(newX, maxX));
            const constrainedY = Math.max(0, Math.min(newY, maxY));
            
            panel.style.position = 'fixed';
            panel.style.left = constrainedX + 'px';
            panel.style.top = constrainedY + 'px';
            panel.style.transform = 'none';
        }
        
        function handleMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        
        // 内容区域
        const contentEl = h('div', {
            style: {
                padding: '15px',
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }
        });
        
        // 多行文本输入框
        const textareaEl = h('textarea', {
            style: {
                width: '100%',
                height: '300px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.4',
                resize: 'vertical',
                minHeight: '200px',
                maxHeight: '500px',
                flex: '1'
            },
            placeholder: '请输入JavaScript代码...\n\n支持多行输入，例如:\nconsole.log("调试信息");\nalert("弹窗测试");\ndocument.querySelector("body").style.background = "red";'
        });
        textareaEl.value = defaultCode;
        
        // 按钮区域
        const buttonArea = h('div', {
            style: {
                padding: '15px',
                borderTop: '1px solid #eee',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
            }
        });
        
        // 执行按钮
        const executeButton = h('button', {
            style: {
                padding: '8px 16px',
                background: 'var(--tmx-bg)',
                color: 'var(--tmx-fg)',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
            },
            onclick: () => executeCode(textareaEl.value, windowId)
        }, '执行代码');
        
        // 清空按钮
        const clearButton = h('button', {
            style: {
                padding: '8px 16px',
                background: '#f8f9fa',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
            },
            onclick: () => {
                textareaEl.value = '';
                textareaEl.focus();
            }
        }, '清空');
        
        buttonArea.appendChild(clearButton);
        buttonArea.appendChild(executeButton);
        
        contentEl.appendChild(textareaEl);
        panel.appendChild(header);
        panel.appendChild(contentEl);
        panel.appendChild(buttonArea);
        overlay.appendChild(panel);
        
        // 存储窗口信息
        const windowInfo = {
            id: windowId,
            overlay,
            panel,
            textareaEl,
            titleEl
        };
        
        activeWindows.set(windowId, windowInfo);
        document.body.appendChild(overlay);
        
        // 聚焦到文本框
        setTimeout(() => textareaEl.focus(), 100);
        
        return windowId;
    }
    
    function minimizeWindow(windowId) {
        const windowInfo = activeWindows.get(windowId);
        if (!windowInfo) return;
        
        // 隐藏窗口
        windowInfo.overlay.style.display = 'none';
        
        // 移动到最小化列表
        minimizedWindows.set(windowId, windowInfo);
        activeWindows.delete(windowId);
        
        // 创建最小化容器
        createMinimizedContainer();
        
        // 创建最小化项
        const minimizedItem = h('div', {
            style: {
                background: 'var(--tmx-bg)',
                color: 'var(--tmx-fg)',
                width: '120px',  // 设置固定宽度，与Toast弹窗一致
                height: '32px',  // 设置固定高度，与Toast弹窗一致
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                boxSizing: 'border-box'  // 确保padding包含在尺寸内
            },
            onclick: () => restoreWindow(windowId)
        });
        
        const titleSpan = h('span', {}, windowInfo.titleEl.textContent);
        const closeBtn = h('span', {
            style: {
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
            },
            onclick: (e) => {
                e.stopPropagation();
                closeWindow(windowId);
            }
        }, '×');
        
        minimizedItem.appendChild(titleSpan);
        minimizedItem.appendChild(closeBtn);
        minimizedContainer.appendChild(minimizedItem);
        
        // 存储最小化项引用
        windowInfo.minimizedItem = minimizedItem;
    }
    
    function restoreWindow(windowId) {
        const windowInfo = minimizedWindows.get(windowId);
        if (!windowInfo) return;
        
        // 显示窗口
        windowInfo.overlay.style.display = 'flex';
        
        // 移回活动列表
        activeWindows.set(windowId, windowInfo);
        minimizedWindows.delete(windowId);
        
        // 移除最小化项
        if (windowInfo.minimizedItem) {
            windowInfo.minimizedItem.remove();
            delete windowInfo.minimizedItem;
        }
        
        // 如果没有最小化窗口了，移除容器
        if (minimizedWindows.size === 0 && minimizedContainer) {
            minimizedContainer.remove();
            minimizedContainer = null;
        }
        
        // 聚焦到文本框
        setTimeout(() => windowInfo.textareaEl.focus(), 100);
    }
    
    function closeWindow(windowId) {
        // 从活动窗口中移除
        const activeWindow = activeWindows.get(windowId);
        if (activeWindow) {
            activeWindow.overlay.remove();
            activeWindows.delete(windowId);
        }
        
        // 从最小化窗口中移除
        const minimizedWindow = minimizedWindows.get(windowId);
        if (minimizedWindow) {
            minimizedWindow.overlay.remove();
            if (minimizedWindow.minimizedItem) {
                minimizedWindow.minimizedItem.remove();
            }
            minimizedWindows.delete(windowId);
        }
        
        // 如果没有最小化窗口了，移除容器
        if (minimizedWindows.size === 0 && minimizedContainer) {
            minimizedContainer.remove();
            minimizedContainer = null;
        }
    }
    
    async function executeCode(code, windowId) {
        if (!code || code.trim() === '') {
            await Dialog.alert('请输入要执行的代码', '提示');
            return;
        }
        
        try {
            console.log(`[调试窗口 #${windowId}] 执行代码:`, code);
            const result = eval(code);
            console.log(`[调试窗口 #${windowId}] 执行结果:`, result);
            
            // 显示执行结果
            if (result !== undefined) {
                const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
                await Dialog.alert(`执行结果:\n${resultStr}`, '调试结果');
            } else {
                await Dialog.alert('代码执行完成（无返回值）', '调试结果');
            }
            
            Logger.append(`[调试窗口] 执行成功: ${code.split('\n')[0]}${code.split('\n').length > 1 ? '...' : ''}`);
        } catch (error) {
            console.error(`[调试窗口 #${windowId}] 执行错误:`, error);
            await Dialog.alert(`执行错误:\n${error.message}\n\n堆栈信息:\n${error.stack}`, '调试错误');
            Logger.append(`[调试窗口] 执行错误: ${error.message}`);
        }
    }
    
    function applyTheme() {
        // 为所有活动窗口应用主题
        activeWindows.forEach(windowInfo => {
            const header = windowInfo.panel.querySelector('div');
            if (header) {
                header.style.background = 'var(--tmx-bg)';
                header.style.color = 'var(--tmx-fg)';
            }
            
            const executeButton = windowInfo.panel.querySelector('button[onclick*="executeCode"]');
            if (executeButton) {
                executeButton.style.background = 'var(--tmx-bg)';
                executeButton.style.color = 'var(--tmx-fg)';
            }
        });
        
        // 为最小化项应用主题
        if (minimizedContainer) {
            const items = minimizedContainer.querySelectorAll('div');
            items.forEach(item => {
                item.style.background = 'var(--tmx-bg)';
                item.style.color = 'var(--tmx-fg)';
            });
        }
    }
    
    return {
        createWindow: createDebugWindow,
        closeWindow,
        minimizeWindow,
        restoreWindow,
        applyTheme
    };
})();

/** *************************** 初始化 *********************************** */
    function init() {
        Theme.apply();
        Logger.hook();
        Logger.append(`${META.name}: v${META.version}`);
        Logger.append(`布局偏移：${getLayoutOffset()}`);

        render();
        Dialog.initialize();
        Dialog.applyTheme();

        // 初始：同步 toast 按钮状态（如果存在）
        const toastOn = store.get('toast.enabled', 0) === 1;
        const toastBtn = buttonMap.get('toast');
        if (toastBtn) {
            toastBtn.textContent = toastOn ? '关闭弹窗' : '弹窗提示';
            toastBtn.style.borderStyle = toastOn ? 'inset' : 'outset';
        }
        if (toastOn) Toast.show('提示', '你好');
        
        // 初始：同步日志显示状态
        const loggerHidden = store.get('logger.hidden', 0) === 1;
        if (loggerHidden) {
            Logger.hide();
            const logBtn = buttonMap.get('toggle-log');
            if (logBtn) {
                logBtn.textContent = '显示日志';
                logBtn.style.borderStyle = 'outset';
            }
        } else {
            Logger.show();
            const logBtn = buttonMap.get('toggle-log');
            if (logBtn) {
                logBtn.textContent = '隐藏日志';
                logBtn.style.borderStyle = 'inset';
            }
        }
        
        // 初始：同步按钮显示状态
        const buttonsHidden = store.get('buttons.hidden', 0) === 1;
        if (buttonsHidden) {
            for (const [id, el] of buttonMap) {
                if (id === 'toggle-buttons') {
                    el.textContent = '显按钮';
                    el.style.borderStyle = 'outset';
                    continue;
                }
                el.style.visibility = 'hidden';
            }
        } else {
            const btnToggle = buttonMap.get('toggle-buttons');
            if (btnToggle) {
                btnToggle.textContent = '隐按钮';
                btnToggle.style.borderStyle = 'inset';
            }
        }

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
