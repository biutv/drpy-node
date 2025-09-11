import {readFile} from 'fs/promises';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {fileURLToPath} from "url";
import {XMLHttpRequest} from 'xmlhttprequest';
import WebSocket, {WebSocketServer} from 'ws';
import path from "path";
import vm from 'vm';
import zlib from 'zlib';
import JSONbig from 'json-bigint';
import forge from "node-forge";
import * as minizlib from 'minizlib';
import * as utils from '../utils/utils.js';
import * as misc from '../utils/misc.js';
import COOKIE from '../utils/cookieManager.js';
import AIS from '../utils/ais.js';
import fileHeaderManager from "../utils/fileHeaderManager.js";
import {getSitesMap} from "../utils/sites-map.js";
import {ENV} from '../utils/env.js';
import {Quark} from "../utils/quark.js";
import {Baidu} from "../utils/baidu.js";
import {UC} from "../utils/uc.js";
import {Ali} from "../utils/ali.js";
import {Cloud} from "../utils/cloud.js";
import {Yun} from "../utils/yun.js";
import {Pan} from "../utils/pan123.js";
import {getContentType, getMimeType} from "../utils/mime-type.js";
import {getParsesDict} from "../utils/file.js";
import {getFirstLetter} from "../utils/pinyin-tool.js";
import {reqs} from "../utils/req.js";
import "../utils/random-http-ua.js";
import {initializeGlobalDollar, rootRequire} from "../libs_drpy/moduleLoader.js";
import {base64Decode, base64Encode, md5, rc4, rc4_decode, rc4Decrypt, rc4Encrypt} from "../libs_drpy/crypto-util.js";
import template from '../libs_drpy/template.js'
import batchExecute from '../libs_drpy/batchExecute.js';
import '../libs_drpy/abba.js'
import '../libs_drpy/jsencrypt.js';
import '../libs_drpy/gb18030.js';
import '../libs_drpy/crypto-js.js';
import '../libs_drpy/node-rsa.js';
import '../libs_drpy/pako.min.js';
import '../libs_drpy/json5.js'
import '../libs_drpy/jinja.js'
import '../libs_drpy/drpyInject.js'
import '../libs_drpy/drpyCustom.js'
import '../libs_drpy/es6-extend.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _data_path = path.join(__dirname, '../data');
const _config_path = path.join(__dirname, '../config');
const _lib_path = path.join(__dirname, '../spider/js');

globalThis.JSONbig = JSONbig; // 抖音弹幕直播必须
globalThis._ENV = process.env;
globalThis._fetch = fetch;
globalThis.JsonBig = JSONbig({storeAsString: true});
globalThis.require = rootRequire;
initializeGlobalDollar();

globalThis.pathLib = {
    basename: path.basename,
    extname: path.extname,
    readFile: function (filename) {
        let _file_path = path.join(_data_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_data_path)) {
            log(`[pathLib.readFile] no access for read ${_file_path}`)
            return '';
        }
        // 检查文件是否存在
        if (!existsSync(resolvedPath)) {
            log(`[pathLib.readFile] file not found for read ${resolvedPath}`)
            return '';
        }
        return readFileSync(resolvedPath, 'utf8')
    },
    writeFile: function (filename, text) {
        let _file_path = path.join(_data_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_data_path)) {
            log(`[pathLib.writeFile] no access for read ${_file_path}`)
            return '';
        }
        try {
            const dirPath = path.dirname(resolvedPath);
            // 检查目录是否存在，不存在则创建
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, {recursive: true});
            }
            writeFileSync(resolvedPath, text, 'utf8');
            return true
        } catch (e) {
            log(`[pathLib.writeFile] failed for saveFile ${_file_path}　error:${e.message}`);
            return false
        }
    },
    readLib: function (filename) {
        let _file_path = path.join(_lib_path, filename);
        const resolvedPath = path.resolve(_data_path, _file_path); // 将路径解析为绝对路径
        if (!resolvedPath.startsWith(_lib_path)) {
            log(`[pathLib.readLib] no access for read ${_file_path}`)
            return '';
        }
        // 检查文件是否存在
        if (!existsSync(resolvedPath)) {
            log(`[pathLib.readLib] file not found for read ${resolvedPath}`)
            return '';
        }
        return readFileSync(resolvedPath, 'utf8')
    },
};
const {sleep, sleepSync, computeHash, deepCopy, urljoin, urljoin2, joinUrl, naturalSort, $js} = utils;
const es6JsPath = path.join(__dirname, '../libs_drpy/es6-extend.js');
// 读取扩展代码
const es6_extend_code = readFileSync(es6JsPath, 'utf8');
const reqJsPath = path.join(__dirname, '../libs_drpy/req-extend.js');
// 读取网络请求扩展代码
const req_extend_code = readFileSync(reqJsPath, 'utf8');
// 缓存已初始化的模块和文件 hash 值
const moduleCache = new Map();
const ruleObjectCache = new Map();
const jxCache = new Map();
// 缓存自动模板匹配时的HOST页面内容，避免重复请求
const hostHtmlCache = new Map();
// 缓存页面请求结果，避免在同一次执行中重复请求相同URL
const pageRequestCache = new Map();
// 记录当前请求会话的标识，用于判断是否需要清理缓存
let currentSessionId = null;
let lastClearTime = 0;
// 全局会话状态管理，记录正在进行的home会话
const activeHomeSessions = new Set();
let pupWebview = null;
if (typeof fetchByHiker === 'undefined') { // 判断是海阔直接放弃导入puppeteer
    try {
        // 尝试动态导入模块puppeteerHelper
        const {puppeteerHelper} = await import('../utils/headless-util.js');  // 使用动态 import
        pupWebview = new puppeteerHelper();
        log('[getSandbox] puppeteerHelper imported successfully');
    } catch (error) {
        // log('Failed to import puppeteerHelper:', error);
        log(`[getSandbox] Failed to import puppeteerHelper:${error.message}`);
    }
}
globalThis.pupWebview = pupWebview;

try {
    if (typeof fetchByHiker !== 'undefined' && typeof globalThis.import === 'function') {
        await globalThis.import('../libs_drpy/crypto-js-wasm.js'); // 海阔放在globalThis里去动态引入
    } else {
        await import('../libs_drpy/crypto-js-wasm.js'); // 使用动态 import规避海阔报错无法运行问题
    }
    globalThis.CryptoJSW = CryptoJSWasm;
} catch (error) {
    // log('Failed to import puppeteerHelper:', error);
    log(`[getSandbox] Failed to import CryptoJSWasm:${error.message}`);
    globalThis.CryptoJSW = {
        loadAllWasm: async function () {
        },
        // MD5: async function (str) {
        //     return md5(str)
        // },
        ...CryptoJS
    };
}

let simplecc = null;
try {
    // 尝试动态导入模块puppeteerHelper
    const simWasm = await import('simplecc-wasm');  // 使用动态 import
    simplecc = simWasm.simplecc;
    log('[getSandbox] simplecc imported successfully');
} catch (error) {
    // log('Failed to import puppeteerHelper:', error);
    log(`[getSandbox] Failed to import simplecc:${error.message}`);
}
globalThis.simplecc = simplecc;

let DataBase = null;
let database = null;
try {
    if (typeof fetchByHiker !== 'undefined' && typeof globalThis.import === 'function') {
        const sqliteUtil = await globalThis.import('../utils/database.js'); // 海阔放在globalThis里去动态引入
        DataBase = sqliteUtil.DataBase;
        database = sqliteUtil.database;
    } else {
        const sqliteUtil = await import('../utils/database.js');  // 使用动态 import
        DataBase = sqliteUtil.DataBase;
        database = sqliteUtil.database;
    }
    log('[getSandbox] sqlite3 database imported successfully');
} catch (error) {
    log(`[getSandbox] Failed to import sqlite3:${error.message}`);
}

globalThis.DataBase = DataBase;
globalThis.database = database;


export async function getSandbox(env = {}) {
    const {getProxyUrl, requestHost, hostUrl, fServer} = env;
    // (可选) 加载所有 wasm 文件
    await CryptoJSW.loadAllWasm();
    const utilsSanbox = {
        sleep,
        sleepSync,
        utils,
        misc,
        computeHash,
        deepCopy,
        urljoin,
        urljoin2,
        joinUrl,
        naturalSort,
        $js,
        $,
        pupWebview,
        getProxyUrl,
        requestHost,
        hostUrl,
        fServer,
        getContentType,
        getMimeType,
        getParsesDict,
        getFirstLetter
    };
    const drpySanbox = {
        jsp,
        pdfh,
        pd,
        pdfa,
        jsoup,
        pdfl,
        pjfh,
        pj,
        pjfa,
        pq,
        local,
        md5X,
        rsaX,
        aesX,
        desX,
        req,
        reqs,
        _fetch,
        XMLHttpRequest,
        simplecc,
        AIS,
        batchFetch,
        JSProxyStream,
        JSFile,
        js2Proxy,
        log,
        print,
        jsonToCookie,
        cookieToJson,
        runMain,
        cachedRequest, // 添加cachedRequest函数到沙箱中
    };
    const drpyCustomSanbox = {
        MOBILE_UA,
        PC_UA,
        UA,
        UC_UA,
        IOS_UA,
        RULE_CK,
        CATE_EXCLUDE,
        TAB_EXCLUDE,
        OCR_RETRY,
        OCR_API,
        nodata,
        SPECIAL_URL,
        setResult,
        setHomeResult,
        setResult2,
        urlDeal,
        tellIsJx,
        urlencode,
        encodeUrl,
        uint8ArrayToBase64,
        Utf8ArrayToStr,
        gzip,
        ungzip,
        encodeStr,
        decodeStr,
        getCryptoJS,
        RSA,
        fixAdM3u8Ai,
        forceOrder,
        getQuery,
        stringify,
        dealJson,
        OcrApi,
        getHome,
        buildUrl,
        keysToLowerCase,
        parseQueryString,
        buildQueryString,
        encodeIfContainsSpecialChars,
        objectToQueryString,
        forge
    };

    const libsSanbox = {
        matchesAll,
        cut,
        gbkTool,
        CryptoJS,
        CryptoJSW,
        JSEncrypt,
        NODERSA,
        pako,
        JSON5,
        jinja,
        template,
        batchExecute,
        atob,
        btoa,
        base64Encode,
        base64Decode,
        md5,
        rc4Encrypt,
        rc4Decrypt,
        rc4,
        rc4_decode,
        randomUa,
        jsonpath,
        hlsParser,
        axios,
        axiosX,
        URL,
        pathLib,
        qs,
        Buffer,
        URLSearchParams,
        COOKIE,
        ENV,
        _ENV,
        Quark,
        Baidu,
        UC,
        Ali,
        Cloud,
        Yun,
        Pan,
        DataBase,
        database,
        require,
        WebSocket,
        WebSocketServer,
        zlib,
        JSONbig,
        JsonBig,
        minizlib,
    };

    // 创建一个沙箱上下文，注入需要的全局变量和函数
    const sandbox = {
        console,      // 将 console 注入沙箱，便于调试
        // eval,    // 直接引入原生 eval(不要这样用，环境是隔离的会导致执行不符合预期，需要包装)
        WebAssembly, // 允许使用原生 WebAssembly(这里即使不引用也可以在沙箱里用这个变量。写在这里骗骗自己吧)
        setTimeout,   // 注入定时器方法
        setInterval,
        clearTimeout,
        clearInterval,
        TextEncoder,
        TextDecoder,
        performance,
        module: {},   // 模块支持
        exports: {},   // 模块支持
        rule: {}, // 用于存放导出的 rule 对象
        jx: {},// 用于存放导出的 解析 对象
        lazy: async function () {
        }, // 用于导出解析的默认函数
        _asyncGetRule: null,
        _asyncGetLazy: null,
        ...utilsSanbox,
        ...drpySanbox,
        ...drpyCustomSanbox,
        ...libsSanbox,
    };
    // 创建一个上下文
    const context = vm.createContext(sandbox);
    // 注入扩展代码到沙箱中
    const polyfillsScript = new vm.Script(es6_extend_code);
    polyfillsScript.runInContext(context);

    // 设置沙箱到全局 $
    sandbox.$.setSandbox(sandbox);
    /*
    if (typeof fetchByHiker !== 'undefined') { // 临时解决海阔不支持eval问题，但是这个eval存在作用域问题，跟非海阔环境的有很大区别，属于残废版本
        sandbox.eval = function (code) {
            const evalScript = new vm.Script(code);
            return evalScript.runInContext(context);
        };
    }
    */
    return {
        sandbox,
        context
    }
}

/**
 * 初始化模块：加载并执行模块文件，存储初始化后的 rule 对象
 * 如果存在 `预处理` 属性且为函数，会在缓存前执行
 * @param {string} filePath - 模块文件路径
 * @param env
 * @param refresh 强制清除缓存
 * @returns {Promise<object>} - 返回初始化后的模块对象
 */
export async function init(filePath, env = {}, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);
        const moduleName = path.basename(filePath, '.js');
        let moduleExt = env.ext || '';
        // log('moduleName:', moduleName);
        // log('moduleExt:', moduleExt);
        let SitesMap = getSitesMap(_config_path);
        // log('SitesMap:', SitesMap);
        if (moduleExt && SitesMap[moduleName]) {
            try {
                moduleExt = ungzip(moduleExt);
            } catch (e) {
                log(`[init] [${moduleName}] ungzip解密moduleExt失败: ${e.message}`);
            }
            if (!SitesMap[moduleName].find(i => i.queryStr === moduleExt) && !SitesMap[moduleName].find(i => i.queryObject.params === moduleExt)) {
                throw new Error("moduleExt is wrong!")
            }
        }
        let hashMd5 = md5(filePath + '#pAq#' + moduleExt);

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.moduleObject;
            }
        }
        log(`[init] Loading module: ${filePath}`);
        let t1 = utils.getNowTime();
        const {sandbox, context} = await getSandbox(env);
        // 执行文件内容，将其放入沙箱中
        const js_code = await getOriginalJs(fileContent);
        // log('js_code:', js_code.slice(5000));
        const js_code_wrapper = `
    _asyncGetRule  = (async function() {
        ${js_code}
        return rule;
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        // ruleScript.runInContext(context);
        // const result = await ruleScript.runInContext(context);
        const executeWithTimeout = (script, context, timeout) => {
            return Promise.race([
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Code execution timed out')), timeout)
                ),
                new Promise((resolve, reject) => {
                    try {
                        const result = script.runInContext(context); // 同步运行脚本
                        if (result && typeof result.then === 'function') {
                            // 如果结果是 Promise，则等待其解析
                            result.then(resolve).catch(reject);
                        } else {
                            // 如果结果是非异步值，直接返回
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                })
            ]);
        };
        const result = await executeWithTimeout(ruleScript, context, 30000);
        // log('result:', result);
        // sandbox.rule = await sandbox._asyncGetRule;
        sandbox.rule = result;

        // rule注入完毕后添加自定义req扩展request方法进入规则,这个代码里可以直接获取rule的任意对象，而且还是独立隔离的
        const reqExtendScript = new vm.Script(req_extend_code);
        reqExtendScript.runInContext(context);
        // 把request / post 函数挂载给rule对象
        sandbox.rule.request = sandbox.request;
        sandbox.rule.post = sandbox.post;

        // 访问沙箱中的 rule 对象。不进行deepCopy了,避免初始化或者预处理对rule.xxx进行修改后，在其他函数里使用却没生效问题
        // const moduleObject = utils.deepCopy(sandbox.rule);
        const rule = sandbox.rule;
        if (moduleExt) { // 传了参数才覆盖rule参数，否则取rule内置
            // log('moduleExt:', moduleExt);
            if (moduleExt.startsWith('../json')) {
                rule.params = urljoin(env.jsonUrl, moduleExt.slice(8));
            } else {
                rule.params = moduleExt
            }
        }
        // 模板继承逻辑处理
        await handleTemplateInheritance(rule, context);

        await initParse(rule, env, vm, context);
        // otherScript放入到initParse去执行
//         const otherScript = new vm.Script(`
// globalThis.jsp = new jsoup(rule.host||'');
// globalThis.pdfh = pdfh;
// globalThis.pd = pd;
// globalThis.pdfa = pdfa;
// globalThis.HOST = rule.host||'';
//         `);
//         otherScript.runInContext(context);
        let t2 = utils.getNowTime();
        const moduleObject = utils.deepCopy(rule);
        moduleObject.cost = t2 - t1;
        moduleObject.context = context; // 将沙箱上下文添加到moduleObject中
        // log(`${filePath} headers:`, moduleObject.headers);
        // 缓存模块和文件的 hash 值
        moduleCache.set(hashMd5, {moduleObject, hash: fileHash});
        return moduleObject;
    } catch (error) {
        log(`[init] Error in drpy.init :${filePath}`, error);
        throw new Error(`[init] Failed to initialize module:${error.message}`);
    }
}

export async function getRuleObject(filePath, env, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (ruleObjectCache.has(filePath) && !refresh) {
            const cached = ruleObjectCache.get(filePath);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.ruleObject;
            }
        }
        // log(`Loading RuleObject: ${filePath} fileSize:${fileContent.length}`);
        let t1 = utils.getNowTime();
        const {sandbox, context} = await getSandbox(env);
        const js_code = await getOriginalJs(fileContent);
        const js_code_wrapper = `
    _asyncGetRule  = (async function() {
        ${js_code}
        return rule;
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        ruleScript.runInContext(context);
        sandbox.rule = await sandbox._asyncGetRule;
        const rule = sandbox.rule;

        // 模板继承逻辑处理
        await handleTemplateInheritance(rule, context);
        let t2 = utils.getNowTime();
        const ruleObject = deepCopy(rule);
        // 设置可搜索、可筛选、可快搜等属性
        ruleObject.searchable = ruleObject.hasOwnProperty('searchable') ? Number(ruleObject.searchable) : 0;
        ruleObject.filterable = ruleObject.hasOwnProperty('filterable') ? Number(ruleObject.filterable) : 0;
        ruleObject.quickSearch = ruleObject.hasOwnProperty('quickSearch') ? Number(ruleObject.quickSearch) : 0;
        ruleObject.cost = t2 - t1;
        // log(`${filePath} headers:`, moduleObject.headers);
        // 缓存模块和文件的 hash 值
        ruleObjectCache.set(filePath, {ruleObject, hash: fileHash});
        return ruleObject
    } catch (error) {
        log(`[getRuleObject] ${filePath} Error in drpy.getRuleObject:${error.message}`);
        return {}
    }
}

export async function initJx(filePath, env, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);
        // env一定传的object。这里只有两种情况 1: 获取配置的时候env传的空{} 2:实际解析传的真实环境，所以hash值只需要0和1
        let hashMd5 = md5(filePath + '#pAq#' + (Object.keys(env).length === 0 ? 0 : 1));

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (jxCache.has(hashMd5) && !refresh) {
            const cached = jxCache.get(hashMd5);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.jxObj;
            }
        }
        log(`[initJx] Loading jx: ${filePath}, hash:${hashMd5}`);
        let t1 = utils.getNowTime();
        // log('env:', env);
        const {sandbox, context} = await getSandbox(env);
        // 执行文件内容，将其放入沙箱中
        const js_code = await getOriginalJs(fileContent);
        const js_code_wrapper = `
    _asyncGetLazy  = (async function() {
        ${js_code}
        return {jx,lazy};
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        ruleScript.runInContext(context);
        const jxResult = await sandbox._asyncGetLazy;
        sandbox.lazy = jxResult.lazy;
        sandbox.jx = jxResult.jx;
        const reqExtendScript = new vm.Script(req_extend_code);
        reqExtendScript.runInContext(context);
        let t2 = utils.getNowTime();
        const jxObj = {...sandbox.jx, lazy: sandbox.lazy};
        const cost = t2 - t1;
        log(`[initJx] 加载解析:${filePath} 耗时 ${cost}毫秒`)
        jxCache.set(hashMd5, {jxObj, hash: fileHash});
        return jxObj;
    } catch (error) {
        log(`[initJx] Error in drpy.initJx:${filePath}`, error);
        throw new Error(`[initJx] Failed to initialize jx:${error.message}`);
    }
}

export async function isLoaded() {
    if (jxCache && jxCache.size > 0) {
        log('[isLoaded] Map 不为空,已完成初始化');
        return true;
    } else {
        log('[isLoaded] Map 为空或未初始化');
        return false;
    }
}

/**
 * 使用临时的上下文调用异步方法，确保每次调用时的上下文 (this) 是独立的。
 * 这样可以避免多个请求之间共享状态，确保数据的隔离性。
 *
 * @param rule 规则本身
 * @param {Function} method - 要调用的异步方法，通常是对象上的方法（例如：moduleObject[method]）
 * @param {Object} injectVars - 用作临时上下文的变量，通常包含一些动态的参数（如：input, MY_URL等）
 * @param {Array} args - 传递给方法的参数列表，会在方法调用时使用
 *
 * @returns {Promise} - 返回异步方法执行的结果，通常是 `await method.apply(...)` 调用的结果
 */
async function invokeWithInjectVars(rule, method, injectVars, args) {
    // return await moduleObject[method].apply(Object.assign(injectVars, moduleObject), args);
    // 这里不使用 bind 或者直接修改原方法，而是通过 apply 临时注入 injectVars 作为 `this` 上下文
    // 这样每次调用时，方法内部的 `this` 会指向 `injectVars`，避免了共享状态，确保数据的隔离性。
    let thisProxy = new Proxy(injectVars, {
        get(injectVars, key) {
            return injectVars[key] || rule[key]
        },
        set(injectVars, key, value) {
            rule[key] = value;
            injectVars[key] = value;
        }
    });
    let result = {};
    let ret_str = '';
    let error = null;
    try {
        result = await method.apply(thisProxy, args);
    } catch (e) {
        error = e;
    }
    if (!['推荐'].includes(injectVars['method']) && error) {
        throw error
    }
    // let result = await method.apply(injectVars, args);  // 使用 apply 临时注入 injectVars 作为上下文，并执行方法
    switch (injectVars['method']) {
        case '推荐':
            if (error) {
                log('[invokeWithInjectVars] error:', error);
                error = null;
                result = [];
            }
            break;
        case 'class_parse':
            result = await homeParseAfter(result, rule.类型, rule.hikerListCol, rule.hikerClassListCol, injectVars);
            break;
        case '一级':
            result = await cateParseAfter(rule, result, args[1]);
            log(`[invokeWithInjectVars] 一级 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
            break;
        case '二级':
            result = await detailParseAfter(result);
            break;
        case '搜索':
            result = await searchParseAfter(rule, result, args[2]);
            log(`[invokeWithInjectVars] 搜索 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
            break;
        case 'lazy':
            result = await playParseAfter(rule, result, args[1], args[0]);
            ret_str = JSON.stringify(result);
            log(`[invokeWithInjectVars] 免嗅 ${injectVars.input} 执行完毕,结果为:`, ret_str.length < 100 ? ret_str : ret_str.slice(0, 100) + '...');
            break;
        case 'proxy_rule':
            break;
        case 'action':
            break;
        default:
            log(`[invokeWithInjectVars] invokeWithInjectVars: ${injectVars['method']}`);
            break;
    }
    if (error) {
        throw error
    }
    return result
}

/**
 * 通用免嗅探解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonLazyParse(moduleObject, method, injectVars, args) {
    // const tmpLazyFunction = async function () {
    //     let {input} = this;
    //     log('[tmpLazyFunction] input:', input);
    //     return input
    // };
    // const tmpLazyFunction = template.common_lazy;
    const lazyMethod = moduleObject[method];
    const request = moduleObject.request;
    const tmpLazyFunction = async function (flag, id, flags) {
        let {input} = this;
        log('[tmpLazyFunction] input:', input);
        let html = await cachedRequest(request, input, {}, 'class');
        let hconf = html.match(/r player_.*?=(.*?)</)[1];
        let json = JSON5.parse(hconf);
        let url = json.url;
        if (json.encrypt == '1') {
            url = unescape(url);
        } else if (json.encrypt == '2') {
            url = unescape(base64Decode(url));
        }
        if (/\.(m3u8|mp4|m4a|mp3)/.test(url)) {
            input = {
                parse: 0,
                jx: 0,
                url: url,
            };
        } else {
            input = url && url.startsWith('http') && tellIsJx(url) ? {parse: 0, jx: 1, url: url} : input;
        }
        log('[tmpLazyFunction] result:', input);
        return input;
    }
    if (lazyMethod && typeof lazyMethod === 'function') {
        try {
            return await invokeWithInjectVars(moduleObject, lazyMethod, injectVars, args);
        } catch (e) {
            let playUrl = injectVars.input || '';
            log(`[commonLazyParse] 执行免嗅代码发送了错误: ${e.message},原始链接为:${playUrl}`);
            if (SPECIAL_URL.test(playUrl) || /^(push:)/.test(playUrl) || playUrl.startsWith('http')) {
                return await invokeWithInjectVars(moduleObject, tmpLazyFunction, injectVars, args);
            } else {
                throw e
            }
        }
    } else if (!lazyMethod) {// 新增特性，可以不写lazy属性
        return await invokeWithInjectVars(moduleObject, tmpLazyFunction, injectVars, args);
    }
}

/**
 * 通用一级字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonCategoryListParse(moduleObject, method, injectVars, args) {
    // 一级字符串p
    let p = moduleObject[method].trim();
    const request = moduleObject.request;
    const tmpFunction = async function () {
        const {input, MY_URL, MY_CATE, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];
        p = p.split(';');
        if (p.length < 5) {
            return d
        }
        let is_json = p[0].startsWith('json:');
        p[0] = p[0].replace(/^(jsp:|json:|jq:)/, '');
        let html = await cachedRequest(request, input, {}, 'class');
        if (html) {
            let $pdfa;
            let $pdfh;
            let $pd;
            if (is_json) {
                html = dealJson(html);
                $pdfa = pjfa;
                $pdfh = pjfh;
                $pd = pj;
            } else {
                $pdfa = pdfa;
                $pdfh = pdfh;
                $pd = pd;
            }
            let list = $pdfa(html, p[0]);
            for (const it of list) {
                let links = p[4].split('+').map(p4 => {
                    return !moduleObject.detailUrl ? $pd(it, p4, MY_URL) : $pdfh(it, p4);
                });
                let link = links.join('$');

                let vod_id = moduleObject.detailUrl ? MY_CATE + '$' + link : link;
                let vod_name = $pdfh(it, p[1]).replace(/\n|\t/g, '').trim();
                let vod_pic = $pd(it, p[2], MY_URL);
                let vod_remarks = $pdfh(it, p[3]).replace(/\n|\t/g, '').trim();

                if (moduleObject['二级'] === '*') {
                    vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
                }
                if (vod_pic) {
                    if (moduleObject['图片替换']) {
                        if (typeof moduleObject['图片替换'] === 'function') {
                            vod_pic = await moduleObject['图片替换'].apply(injectVars, [vod_pic]);
                        } else if (typeof moduleObject['图片替换'] === 'string' && moduleObject['图片替换'].includes('=>')) {
                            let replace_from = moduleObject['图片替换'].split('=>')[0];
                            let replace_to = moduleObject['图片替换'].split('=>')[1];
                            vod_pic = vod_pic.replace(replace_from, replace_to);
                        }
                    }
                    if (moduleObject['图片来源'] && vod_pic && vod_pic.startsWith('http')) {
                        vod_pic += moduleObject['图片来源'];
                    }
                }
                d.push({
                    'vod_id': vod_id,
                    'vod_name': vod_name,
                    'vod_pic': vod_pic,
                    'vod_remarks': vod_remarks,
                });
            }
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 推荐和搜索单字段继承一级
 * @param p 推荐或搜索的解析分割;列表
 * @param pn 自身列表序号
 * @param pp  一级解析分割;列表
 * @param ppn 继承一级序号
 * @returns {*}
 */
function getPP(p, pn, pp, ppn) {
    try {
        return p[pn] === '*' && pp.length > ppn ? pp[ppn] : p[pn]
    } catch (e) {
        return ''
    }
}


/**
 * 通用搜索字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonSearchListParse(moduleObject, method, injectVars, args) {
    // 搜索字符串p
    let p = moduleObject[method] === '*' && moduleObject['一级'] ? moduleObject['一级'] : moduleObject[method];
    // 一级是函数直接调用函数
    if (typeof p === 'function') {
        // log('搜索继承一级函数');
        return await invokeWithInjectVars(moduleObject, p, injectVars, args);
    }
    p = p.trim();
    let pp = typeof moduleObject['一级'] === 'string' ? moduleObject['一级'].split(';') : [];
    const rule_fetch_params = moduleObject.rule_fetch_params;
    const searchWd = injectVars.KEY;
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];
        p = p.split(';');
        if (p.length < 5) {
            return d
        }
        let p0 = getPP(p, 0, pp, 0);
        let is_json = p0.startsWith('json:');
        p0 = p0.replace(/^(jsp:|json:|jq:)/, '');
        let req_method = MY_URL.split(';').length > 1 ? MY_URL.split(';')[1].toLowerCase() : 'get';
        let html;
        if (req_method === 'post') {
            let rurls = MY_URL.split(';')[0].split('#')
            let rurl = rurls[0]
            let params = rurls.length > 1 ? rurls[1] : '';
            log(`[commonSearchListParse] post=》rurl:${rurl},params:${params}`);
            let _fetch_params = deepCopy(rule_fetch_params);
            let postData = {body: params};
            Object.assign(_fetch_params, postData);
            html = await post(rurl, _fetch_params);
        } else if (req_method === 'postjson') {
            let rurls = MY_URL.split(';')[0].split('#')
            let rurl = rurls[0]
            let params = rurls.length > 1 ? rurls[1] : '';
            log(`[commonSearchListParse] postjson-》rurl:${rurl},params:${params}`);
            try {
                params = JSON.parse(params);
            } catch (e) {
                params = '{}'
            }
            let _fetch_params = deepCopy(rule_fetch_params);
            let postData = {body: params};
            Object.assign(_fetch_params, postData);
            html = await post(rurl, _fetch_params);
        } else {
            // 在沙箱环境中执行getHtml获取源码，自动带入验证成功的cookie
            const getHtmlScript = new vm.Script(`
                (async function() {
                    try {
                        return await getHtml('${MY_URL}');
                    } catch (e) {
                        log('获取HTML异常:', e.message);
                        return '';
                    }
                })()
            `);
            html = await getHtmlScript.runInContext(moduleObject.context);
        }

        // 解决搜索源码奇葩触发自动过验证逻辑
        if (html) {
            let search_tag = moduleObject['搜索验证标识'] || '系统安全验证|输入验证码';
            if (new RegExp(search_tag).test(html)) {
                log('[verifyCode] 遇到搜索验证码,尝试过验证:', html);
                // 在沙箱中执行验证码处理逻辑
                const verifyScript = new vm.Script(`
                    (async function() {
                        try {
                            let cookie = await verifyCode('${MY_URL}');
                            if (cookie) {
                                log('本次成功过验证,cookie:' + cookie);
                                setItem(RULE_CK, cookie);
                                return cookie;
                            } else {
                                log('本次自动过搜索验证失败,cookie:' + cookie);
                                return null;
                            }
                        } catch (e) {
                            log('验证码处理异常:', e.message);
                            return null;
                        }
                    })()
                `);
                const cookie = await verifyScript.runInContext(moduleObject.context);
                // 在沙箱环境中重新获取正确的HTML
                const getHtmlScript = new vm.Script(`
                    (async function() {
                        try {
                            return await getHtml('${MY_URL}');
                        } catch (e) {
                            log('重新获取HTML异常:', e.message);
                            return '';
                        }
                    })()
                `);
                html = await getHtmlScript.runInContext(moduleObject.context);
            }
        }

        if (html) {
            if (!html.includes(searchWd)) {
                log(`[commonSearchListParse] 搜索结果源码未包含关键字【${searchWd}】,疑似搜索失败,正为您打印结果源码`);
                log('[commonSearchListParse]', html.slice(0, 200) + '...');
            }
            let $pdfa;
            let $pdfh;
            let $pd;
            if (is_json) {
                html = dealJson(html);
                $pdfa = pjfa;
                $pdfh = pjfh;
                $pd = pj;
            } else {
                $pdfa = pdfa;
                $pdfh = pdfh;
                $pd = pd;
            }
            let list = $pdfa(html, p0);
            let p1 = getPP(p, 1, pp, 1);
            let p2 = getPP(p, 2, pp, 2);
            let p3 = getPP(p, 3, pp, 3);
            let p4 = getPP(p, 4, pp, 4);
            let p5 = getPP(p, 5, pp, 5);
            for (const it of list) {
                let links = p4.split('+').map(_p4 => {
                    return !moduleObject.detailUrl ? $pd(it, _p4, MY_URL) : $pdfh(it, _p4)
                });
                let link = links.join('$');
                let content;
                if (p.length > 5 && p[5]) {
                    content = $pdfh(it, p5);
                } else {
                    content = '';
                }
                let vod_id = link;
                let vod_name = $pdfh(it, p1).replace(/\n|\t/g, '').trim();
                let vod_pic = $pd(it, p2, MY_URL);
                let vod_remarks = $pdfh(it, p3).replace(/\n|\t/g, '').trim();
                let vod_content = content.replace(/\n|\t/g, '').trim();

                if (moduleObject['二级'] === '*') {
                    vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
                }
                if (vod_pic) {
                    if (moduleObject['图片替换']) {
                        if (typeof moduleObject['图片替换'] === 'function') {
                            vod_pic = await moduleObject['图片替换'].apply(injectVars, [vod_pic]);
                        } else if (typeof moduleObject['图片替换'] === 'string' && moduleObject['图片替换'].includes('=>')) {
                            let replace_from = moduleObject['图片替换'].split('=>')[0];
                            let replace_to = moduleObject['图片替换'].split('=>')[1];
                            vod_pic = vod_pic.replace(replace_from, replace_to);
                        }
                    }
                    if (moduleObject['图片来源'] && vod_pic && vod_pic.startsWith('http')) {
                        vod_pic += moduleObject['图片来源'];
                    }
                }
                d.push({
                    'vod_id': vod_id,
                    'vod_name': vod_name,
                    'vod_pic': vod_pic,
                    'vod_remarks': vod_remarks,
                    'vod_content': vod_content,
                });
            }
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用分类解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonClassParse(moduleObject, method, injectVars, args) {
    // class_parse字符串p
    let p = moduleObject[method].trim();
    const request = moduleObject.request;
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        let classes = [];

        // 处理class_parse字符串解析
        p = p.split(';');
        let p0 = p[0];
        let is_json = p0.startsWith('json:');
        p0 = p0.replace(/^(jsp:|json:|jq:)/, '');

        // 使用cachedRequest来避免重复请求，使用'host'前缀与其他函数保持一致
        let html = await cachedRequest(request, input, {}, 'host');
        if (html) {
            let $pdfa;
            let $pdfh;
            let $pd;
            if (is_json) {
                html = dealJson(html);
                $pdfa = pjfa;
                $pdfh = pjfh;
                $pd = pj;
            } else {
                $pdfa = pdfa;
                $pdfh = pdfh;
                $pd = pd;
            }

            if (is_json) {
                try {
                    let list = $pdfa(html, p0);
                    if (list && list.length > 0) {
                        classes = list;
                    }
                } catch (e) {
                    log(`[commonClassParse] json分类解析失败:${e.message}`);
                }
            } else if (p.length >= 3) { // 可以不写正则
                try {
                    let list = $pdfa(html, p0);
                    if (list && list.length > 0) {
                        for (const it of list) {
                            try {
                                //log('[commonClassParse] it:', it);
                                let name = $pdfh(it, p[1]);
                                let url = $pd(it, p[2]);
                                if (p.length > 3 && p[3]) {
                                    let exp = new RegExp(p[3]);
                                    let match = url.match(exp);
                                    if (match && match[1]) {
                                        url = match[1];
                                    }
                                }
                                if (name.trim()) {
                                    classes.push({
                                        'type_id': url.trim(),
                                        'type_name': name.trim()
                                    });
                                }
                            } catch (e) {
                                log(`[commonClassParse] 分类列表解析元素失败:${e.message}`);
                            }
                        }
                    }
                } catch (e) {
                    log(`[commonClassParse] 分类列表解析失败:${e.message}`);
                }
            }
        }
        return {class: classes};
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用推荐字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonHomeListParse(moduleObject, method, injectVars, args) {
    // 推荐字符串p
    let p = moduleObject[method] === '*' && moduleObject['一级'] ? moduleObject['一级'] : moduleObject[method];
    // 一级是函数直接调用函数
    if (typeof p === 'function') {
        // log('推荐继承一级函数');
        return await invokeWithInjectVars(moduleObject, p, injectVars, args);
    }
    // 推荐完全和一级相同的话，双重定位为false
    if (moduleObject[method] === '*') {
        moduleObject['double'] = false;
    }

    p = p.trim();
    let pp = typeof moduleObject['一级'] === 'string' ? moduleObject['一级'].split(';') : [];
    const request = moduleObject.request;
    const is_double = moduleObject.double;
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];
        p = p.split(';');
        if ((!is_double && p.length < 5) || (is_double && p.length < 6)) {
            return d
        }
        let p0 = getPP(p, 0, pp, 0);
        let is_json = p0.startsWith('json:');
        p0 = p0.replace(/^(jsp:|json:|jq:)/, '');
        let html = await cachedRequest(request, MY_URL, {}, 'host'); // 使用'host'前缀与其他函数保持一致
        if (html) {
            let $pdfa;
            let $pdfh;
            let $pd;
            if (is_json) {
                html = dealJson(html);
                $pdfa = pjfa;
                $pdfh = pjfh;
                $pd = pj;
            } else {
                $pdfa = pdfa;
                $pdfh = pdfh;
                $pd = pd;
            }
            let list = $pdfa(html, p0);

            if (is_double) {
                let p1 = getPP(p, 1, pp, 0);
                let p2 = getPP(p, 2, pp, 1);
                let p3 = getPP(p, 3, pp, 2);
                let p4 = getPP(p, 4, pp, 3);
                let p5 = getPP(p, 5, pp, 4);
                let p6 = getPP(p, 6, pp, 5);

                for (const it of list) {
                    let list2 = $pdfa(it, p1);
                    for (let it2 of list2) {
                        let vod_name = $pdfh(it2, p2);
                        let vod_pic = '';
                        try {
                            vod_pic = $pd(it2, p3);
                        } catch (e) {
                        }
                        let vod_remarks = '';
                        try {
                            vod_remarks = $pdfh(it2, p4);
                        } catch (e) {
                        }

                        let links = [];
                        for (let _p5 of p5.split('+')) {
                            let link = !moduleObject.detailUrl ? $pd(it2, _p5, MY_URL) : $pdfh(it2, _p5);
                            links.push(link);
                        }
                        let vod_id = links.join('$');

                        let vod_content;
                        if (p.length > 6 && p[6]) {
                            vod_content = $pdfh(it2, p6);
                        } else {
                            vod_content = '';
                        }

                        if (moduleObject['二级'] === '*') {
                            vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
                        }
                        if (vod_pic) {
                            if (moduleObject['图片替换']) {
                                if (typeof moduleObject['图片替换'] === 'function') {
                                    vod_pic = await moduleObject['图片替换'].apply(injectVars, [vod_pic]);
                                } else if (typeof moduleObject['图片替换'] === 'string' && moduleObject['图片替换'].includes('=>')) {
                                    let replace_from = moduleObject['图片替换'].split('=>')[0];
                                    let replace_to = moduleObject['图片替换'].split('=>')[1];
                                    vod_pic = vod_pic.replace(replace_from, replace_to);
                                }
                            }
                            if (moduleObject['图片来源'] && vod_pic && vod_pic.startsWith('http')) {
                                vod_pic += moduleObject['图片来源'];
                            }
                        }

                        d.push({
                            'vod_id': vod_id,
                            'vod_name': vod_name,
                            'vod_pic': vod_pic,
                            'vod_remarks': vod_remarks,
                            'vod_content': vod_content,
                        });

                    }


                }
            } else {
                let p1 = getPP(p, 1, pp, 1);
                let p2 = getPP(p, 2, pp, 2);
                let p3 = getPP(p, 3, pp, 3);
                let p4 = getPP(p, 4, pp, 4);
                let p5 = getPP(p, 5, pp, 5);


                for (let it of list) {
                    let vod_name = $pdfh(it, p1);
                    let vod_pic = '';
                    try {
                        vod_pic = $pd(it, p2);
                    } catch (e) {
                    }
                    let vod_remarks = '';
                    try {
                        vod_remarks = $pdfh(it, p3);
                    } catch (e) {
                    }
                    let links = [];
                    for (let _p5 of p4.split('+')) {
                        let link = !moduleObject.detailUrl ? $pd(it, _p5, MY_URL) : $pdfh(it, _p5);
                        links.push(link);
                    }
                    let vod_id = links.join('$');
                    let vod_content;
                    if (p.length > 5 && p[5]) {
                        vod_content = $pdfh(it, p5);
                    } else {
                        vod_content = '';
                    }

                    if (moduleObject['二级'] === '*') {
                        vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
                    }
                    if (vod_pic) {
                        if (moduleObject['图片替换']) {
                            if (typeof moduleObject['图片替换'] === 'function') {
                                vod_pic = await moduleObject['图片替换'].apply(injectVars, [vod_pic]);
                            } else if (typeof moduleObject['图片替换'] === 'string' && moduleObject['图片替换'].includes('=>')) {
                                let replace_from = moduleObject['图片替换'].split('=>')[0];
                                let replace_to = moduleObject['图片替换'].split('=>')[1];
                                vod_pic = vod_pic.replace(replace_from, replace_to);
                            }
                        }
                        if (moduleObject['图片来源'] && vod_pic && vod_pic.startsWith('http')) {
                            vod_pic += moduleObject['图片来源'];
                        }
                    }
                    d.push({
                        'vod_id': vod_id,
                        'vod_name': vod_name,
                        'vod_pic': vod_pic,
                        'vod_remarks': vod_remarks,
                        'vod_content': vod_content,
                    });
                }
            }
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 调用模块的指定方法
 * @param {string} filePath - 模块文件路径
 * @param env 全局的环境变量-针对本规则，如代理地址
 * @param {string} method - 要调用的属性方法名称
 * @param args - 传递给方法的普通参数
 * @param {object} injectVars - 需要注入的变量（如 input 和 MY_URL）
 * @returns {Promise<any>} - 方法调用的返回值
 */
async function invokeMethod(filePath, env, method, args = [], injectVars = {}) {
    const moduleObject = await init(filePath, env); // 确保模块已初始化
    switch (method) {
        case 'get_rule':
            return moduleObject;
        case 'class_parse':
            injectVars = await homeParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '推荐':
            injectVars = await homeVodParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '一级':
            injectVars = await cateParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '二级':
            injectVars = await detailParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case '搜索':
            injectVars = await searchParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case 'lazy':
            injectVars = await playParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case 'proxy_rule':
            injectVars = await proxyParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
    }
    injectVars['method'] = method;
    // 环境变量扩展进入this区域
    Object.assign(injectVars, env);
    // 免嗅探代码特殊处理: 必须是函数或者没写
    if (method === 'lazy' && ((moduleObject[method] && typeof moduleObject[method] === 'function') || !moduleObject[method])) {
        return await commonLazyParse(moduleObject, method, injectVars, args)
    }
    // 字符串lazy直接返回嗅探
    else if (method === 'lazy' && typeof moduleObject[method] === 'string') {
        return {
            parse: 1,
            url: injectVars.input,
            header: moduleObject.headers && Object.keys(moduleObject.headers).length > 0 ? moduleObject.headers : undefined
        }
    }
    // 分类动态解析特殊处理:允许不写
    else if (method === 'class_parse' && !moduleObject[method]) { // 新增特性，可以不写class_parse属性
        const tmpClassFunction = async function () {
        };
        return await invokeWithInjectVars(moduleObject, tmpClassFunction, injectVars, args);
    }
    // 特殊处理class_parse字符串
    else if (method === 'class_parse' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonClassParse(moduleObject, method, injectVars, args);
    }
    // 函数直接执行
    else if (moduleObject[method] && typeof moduleObject[method] === 'function') {
        // log('injectVars:', injectVars);
        return await invokeWithInjectVars(moduleObject, moduleObject[method], injectVars, args);
    }
    // 特殊处理一级字符串
    else if (method === '一级' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonCategoryListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理搜索字符串
    else if (method === '搜索' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonSearchListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理推荐字符串
    else if (method === '推荐' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonHomeListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理二级字符串或对象
    else if (method === '二级' && (moduleObject[method] === '*' || (moduleObject[method] && typeof moduleObject[method] === 'object'))) {
        return await commonDetailListParse(moduleObject, method, injectVars, args);
    } else {
        // 其他未知函数或者函数属性是字符串
        if (['推荐', '一级', '搜索'].includes(method)) {
            return []
        } else if (['二级'].includes(method)) {
            return {}
        } else {  // class_parse一定要有，这样即使不返回数据都能自动取class_name和class_url的内容
            throw new Error(`Method ${method} not found in module ${filePath}`);
        }
    }
}

async function initParse(rule, env, vm, context) {
    rule.host = (rule.host || '').rstrip('/');
    // 检查并执行 `hostJs` 方法
    if (typeof rule.hostJs === 'function') {
        log('[initParse] Executing hostJs...');
        try {
            let HOST = await rule.hostJs.apply({input: rule.host, MY_URL: rule.host, HOST: rule.host});
            if (HOST) {
                rule.host = HOST.rstrip('/');
                log(`[initParse] 已动态设置规则【${rule.title}】的host为: ${rule.host}`);
            }
        } catch (e) {
            log(`[initParse] hostJs执行错误:${e.message}`);
        }
    }
    let rule_cate_excludes = (rule.cate_exclude || '').split('|').filter(it => it.trim());
    let rule_tab_excludes = (rule.tab_exclude || '').split('|').filter(it => it.trim());
    rule_cate_excludes = rule_cate_excludes.concat(CATE_EXCLUDE.split('|').filter(it => it.trim()));
    rule_tab_excludes = rule_tab_excludes.concat(TAB_EXCLUDE.split('|').filter(it => it.trim()));

    rule.cate_exclude = rule_cate_excludes.join('|');
    rule.tab_exclude = rule_tab_excludes.join('|');

    rule.类型 = rule.类型 || '影视'; // 影视|听书|漫画|小说
    rule.url = rule.url || '';
    rule.double = rule.double || false;
    rule.homeUrl = rule.homeUrl || '';
    rule.detailUrl = rule.detailUrl || '';
    rule.searchUrl = rule.searchUrl || '';
    rule.homeUrl = rule.host && rule.homeUrl ? urljoin(rule.host, rule.homeUrl) : (rule.homeUrl || rule.host);
    rule.homeUrl = jinja.render(rule.homeUrl, {rule: rule});
    rule.detailUrl = rule.host && rule.detailUrl ? urljoin(rule.host, rule.detailUrl) : rule.detailUrl;
    rule.二级访问前 = rule.二级访问前 || '';
    if (rule.url.includes('[') && rule.url.includes(']')) {
        let u1 = rule.url.split('[')[0]
        let u2 = rule.url.split('[')[1].split(']')[0]
        rule.url = rule.host && rule.url ? urljoin(rule.host, u1) + '[' + urljoin(rule.host, u2) + ']' : rule.url;
    } else {
        rule.url = rule.host && rule.url ? urljoin(rule.host, rule.url) : rule.url;
    }
    if (rule.searchUrl.includes('[') && rule.searchUrl.includes(']') && !rule.searchUrl.includes('#')) {
        let u1 = rule.searchUrl.split('[')[0]
        let u2 = rule.searchUrl.split('[')[1].split(']')[0]
        rule.searchUrl = rule.host && rule.searchUrl ? urljoin(rule.host, u1) + '[' + urljoin(rule.host, u2) + ']' : rule.searchUrl;
    } else {
        rule.searchUrl = rule.host && rule.searchUrl ? urljoin(rule.host, rule.searchUrl) : rule.searchUrl;
    }
    rule.timeout = rule.timeout || 5000;
    rule.encoding = rule.编码 || rule.encoding || 'utf-8';
    rule.search_encoding = rule.搜索编码 || rule.search_encoding || '';
    rule.图片来源 = rule.图片来源 || '';
    rule.图片替换 = rule.图片替换 || '';
    rule.play_json = rule.hasOwnProperty('play_json') ? rule.play_json : [];
    rule.pagecount = rule.hasOwnProperty('pagecount') ? rule.pagecount : {};
    rule.proxy_rule = rule.hasOwnProperty('proxy_rule') ? rule.proxy_rule : '';
    if (!rule.hasOwnProperty('sniffer')) { // 默认关闭辅助嗅探
        rule.sniffer = false;
    }
    rule.sniffer = rule.hasOwnProperty('sniffer') ? rule.sniffer : '';
    rule.sniffer = !!(rule.sniffer && rule.sniffer !== '0' && rule.sniffer !== 'false');
    rule.isVideo = rule.hasOwnProperty('isVideo') ? rule.isVideo : '';
    if (rule.sniffer && !rule.isVideo) { // 默认辅助嗅探自动增强嗅探规则
        rule.isVideo = 'http((?!http).){12,}?\\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)\\?.*|http((?!http).){12,}\\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)|http((?!http).)*?video/tos*|http((?!http).)*?obj/tos*';
    }

    rule.tab_remove = rule.hasOwnProperty('tab_remove') ? rule.tab_remove : [];
    rule.tab_order = rule.hasOwnProperty('tab_order') ? rule.tab_order : [];
    rule.tab_rename = rule.hasOwnProperty('tab_rename') ? rule.tab_rename : {};

    if (rule.headers && typeof (rule.headers) === 'object') {
        try {
            let header_keys = Object.keys(rule.headers);
            for (let k of header_keys) {
                if (k.toLowerCase() === 'user-agent') {
                    let v = rule.headers[k];
                    if (['MOBILE_UA', 'PC_UA', 'UC_UA', 'IOS_UA', 'UA'].includes(v)) {
                        rule.headers[k] = eval(v);
                        log('[initParse]', rule.headers[k])
                    }
                } else if (k.toLowerCase() === 'cookie') {
                    let v = rule.headers[k];
                    if (v && v.startsWith('http')) {
                        try {
                            // 使用cachedRequest来避免重复请求，使用'host'前缀与handleTemplateInheritance保持一致
                            // 使用request函数以确保与handleTemplateInheritance的缓存兼容
                            // 传递headers参数以确保与handleTemplateInheritance的缓存键一致
                            v = await cachedRequest(request, v, {headers: rule.headers || {}}, 'host');
                            rule.headers[k] = v;
                        } catch (e) {
                            log(`[initParse] 从${v}获取cookie发生错误:${e.message}`);
                        }
                    }
                }
            }
        } catch (e) {
            log(`[initParse] 处理headers发生错误:${e.message}`);
        }
    } else {
        rule.headers = {}
    }
    // 新版放入规则内部
    rule.oheaders = deepCopy(rule.headers);
    rule.rule_fetch_params = {'headers': rule.headers, 'timeout': rule.timeout, 'encoding': rule.encoding};
    const originalScript = new vm.Script(`
globalThis.oheaders = rule.oheaders
globalThis.rule_fetch_params = rule.rule_fetch_params;
        `);
    originalScript.runInContext(context);

    // 检查并执行 `预处理` 方法
    if (typeof rule.预处理 === 'function') {
        log('[initParse] Executing 预处理...');
        await rule.预处理(env);
    }

    const otherScript = new vm.Script(`
globalThis.jsp = new jsoup(rule.host||'');
globalThis.pdfh = pdfh;
globalThis.pd = pd;
globalThis.pdfa = pdfa;
globalThis.HOST = rule.host||'';
        `);
    otherScript.runInContext(context);
    return rule
}

async function homeParse(rule) {
    let url = rule.homeUrl;
    if (typeof (rule.filter) === 'string' && rule.filter.trim().length > 0) {
        try {
            let filter_json = ungzip(rule.filter.trim());
            // log(filter_json);
            rule.filter = JSON.parse(filter_json);
        } catch (e) {
            log(`[homeParse] [${rule.title}] filter ungzip或格式化解密出错: ${e.message}`);
            rule.filter = {};
        }
    }
    let classes = [];
    if (rule.class_name && rule.class_url) {
        let names = rule.class_name.split('&');
        let urls = rule.class_url.split('&');
        let cnt = Math.min(names.length, urls.length);
        for (let i = 0; i < cnt; i++) {
            classes.push({
                'type_id': urls[i],
                'type_name': names[i],
                'type_flag': rule['class_flag'],
            });
        }
    }
    const jsp = new jsoup(url);
    return {
        TYPE: 'home',
        input: url,
        MY_URL: url,
        HOST: rule.host,
        classes: classes,
        filters: rule.filter,
        cate_exclude: rule.cate_exclude,
        home_flag: rule.home_flag,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }

}

async function homeParseAfter(d, _type, hikerListCol, hikerClassListCol, injectVars) {
    if (!d) {
        d = {};
    }
    d.type = _type || '影视';
    if (hikerListCol) {
        d.hikerListCol = hikerListCol;
    }
    if (hikerClassListCol) {
        d.hikerClassListCol = hikerClassListCol;
    }
    const {
        classes,
        filters,
        cate_exclude,
        home_flag,
    } = injectVars;
    if (!Array.isArray(d.class)) {
        d.class = classes;
    }
    if (!d.filters) {
        d.filters = filters;
    }
    if (!d.list) {
        d.list = [];
    }
    if (!d.type_flag && home_flag) {
        d.type_flag = home_flag;
    }
    d.class = d.class.filter(it => !cate_exclude || !(new RegExp(cate_exclude).test(it.type_name)));
    return d
}

async function homeVodParse(rule) {
    let url = rule.homeUrl;
    const jsp = new jsoup(url);
    return {
        TYPE: 'home',
        input: url,
        MY_URL: url,
        HOST: rule.host,
        double: rule.double,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }
}

async function cateParse(rule, tid, pg, filter, extend) {
    log('[cateParse]', tid, pg, filter, extend);
    let url = rule.url.replaceAll('fyclass', tid);
    if (pg === 1 && url.includes('[') && url.includes(']')) {
        url = url.split('[')[1].split(']')[0];
    } else if (pg > 1 && url.includes('[') && url.includes(']')) {
        url = url.split('[')[0];
    }
    if (rule.filter_def && typeof (rule.filter_def) === 'object') {
        try {
            if (Object.keys(rule.filter_def).length > 0 && rule.filter_def.hasOwnProperty(tid)) {
                let self_fl_def = rule.filter_def[tid];
                if (self_fl_def && typeof (self_fl_def) === 'object') {
                    let k = [Object.keys(self_fl_def)][0]
                    k.forEach(k => {
                        if (!extend.hasOwnProperty(k)) {
                            extend[k] = self_fl_def[k];
                        }
                    })
                }
            }
        } catch (e) {
            log(`[cateParse] 合并不同分类对应的默认筛选出错:${e.message}`);
        }
    }
    if (rule.filter_url) {
        if (!/fyfilter/.test(url)) {
            if (!url.endsWith('&') && !rule.filter_url.startsWith('&')) {
                url += '&'
            }
            url += rule.filter_url;
        } else {
            url = url.replace('fyfilter', rule.filter_url);
        }
        url = url.replaceAll('fyclass', tid);
        let fl = filter ? extend : {};
        if (rule.filter_def && typeof (rule.filter_def) === 'object') {
            try {
                if (Object.keys(rule.filter_def).length > 0 && rule.filter_def.hasOwnProperty(tid)) {
                    let self_fl_def = rule.filter_def[tid];
                    if (self_fl_def && typeof (self_fl_def) === 'object') {
                        let fl_def = deepCopy(self_fl_def);
                        fl = Object.assign(fl_def, fl);
                    }
                }
            } catch (e) {
                log(`[cateParse] 合并不同分类对应的默认筛选出错:${e.message}`);
            }
        }
        let new_url;
        new_url = jinja.render(url, {fl: fl, fyclass: tid});
        url = new_url;
    }
    if (/fypage/.test(url)) {
        if (url.includes('(') && url.includes(')')) {
            let url_rep = url.match(/.*?\((.*)\)/)[1];
            let cnt_page = url_rep.replaceAll('fypage', pg);
            let cnt_pg = eval(cnt_page);
            url = url.replaceAll(url_rep, cnt_pg).replaceAll('(', '').replaceAll(')', '');
        } else {
            url = url.replaceAll('fypage', pg);
        }
    }
    const jsp = new jsoup(url);
    return {
        MY_CATE: tid,
        MY_FL: extend,
        TYPE: 'cate',
        input: url,
        MY_URL: url,
        HOST: rule.host,
        MY_PAGE: pg,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }
}

async function cateParseAfter(rule, d, pg) {
    return d.length < 1 ? nodata : {
        'page': parseInt(pg),
        'pagecount': 9999,
        'limit': Number(rule.limit) || 20,
        'total': 999999,
        'list': d,
    }
}

async function detailParse(rule, ids) {
    let vid = ids[0].toString();
    let orId = vid;
    let fyclass = '';
    log('[detailParse] orId:' + orId);
    if (vid.indexOf('$') > -1) {
        let tmp = vid.split('$');
        fyclass = tmp[0];
        vid = tmp[1];
    }
    let detailUrl = vid.split('@@')[0];
    let url;
    if (!detailUrl.startsWith('http') && !detailUrl.includes('/')) {
        url = rule.detailUrl.replaceAll('fyid', detailUrl).replaceAll('fyclass', fyclass);
    } else if (detailUrl.includes('/')) {
        url = urljoin(rule.homeUrl, detailUrl);
    } else {
        url = detailUrl
    }
    // 处理二级为对象的情况
    if (rule.二级 && typeof rule.二级 === 'object') {
        return await detailParseObject(rule, url, vid, orId, fyclass);
    }

    const jsp = new jsoup(url);
    return {
        TYPE: 'detail',
        input: url,
        vid: vid,
        orId: orId,
        fyclass: fyclass,
        MY_URL: url,
        detailUrl: detailUrl,
        HOST: rule.host,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pdfl: jsp.pdfl.bind(jsp), // 二级绑定pdfl函数
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }
}

/**
 * 通用二级字符串/对象解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
async function commonDetailListParse(moduleObject, method, injectVars, args) {
    // 二级字符串或对象p
    let p = moduleObject[method];
    const request = moduleObject.request;
    const tmpFunction = async function () {
        const {input, vid, orId, fyclass, MY_URL, HOST, fetch_params, jsp, pdfh, pdfa, pd, pdfl, pjfh, pjfa, pj} = this;

        let vod_name = '片名';
        let vod_pic = '';
        let vod_id = orId;

        if (p === '*') {
            let extra = orId.split('@@');
            vod_name = extra.length > 1 ? extra[1] : vod_name;
            vod_pic = extra.length > 2 ? extra[2] : vod_pic;
        }

        let vod = {
            vod_id: vod_id,
            vod_name: vod_name,
            vod_pic: vod_pic,
            type_name: '类型',
            vod_year: '年份',
            vod_area: '地区',
            vod_remarks: '更新信息',
            vod_actor: '主演',
            vod_director: '导演',
            vod_content: '简介',
        };

        let html = '';

        // 执行二级访问前代码
        if (moduleObject.二级访问前 && typeof moduleObject.二级访问前 === 'function') {
            log('[commonDetailListParse] 开始执行二级访问前代码');
            try {
                const result = await moduleObject.二级访问前.call(this);
                // 如果二级访问前返回了新的URL，需要重新构建解析环境
                if (result && result !== this.MY_URL) {
                    log(`[commonDetailListParse] 二级访问前返回新URL: ${result}`);
                    this.MY_URL = result;
                    this.input = result;
                    // 重新创建jsp对象和绑定解析函数
                    const newJsp = new jsoup(result);
                    this.jsp = newJsp;
                    this.pdfh = newJsp.pdfh.bind(newJsp);
                    this.pdfa = newJsp.pdfa.bind(newJsp);
                    this.pd = newJsp.pd.bind(newJsp);
                    this.pdfl = newJsp.pdfl.bind(newJsp);
                    this.pjfh = newJsp.pjfh.bind(newJsp);
                    this.pjfa = newJsp.pjfa.bind(newJsp);
                    this.pj = newJsp.pj.bind(newJsp);
                    // 清空html，强制重新获取
                    html = '';
                }
            } catch (e) {
                log(`[commonDetailListParse] 二级访问前执行失败:${e.message}`);
            }
        }

        if (p === '*') {
            vod.vod_play_from = '道长在线';
            vod.vod_remarks = input;
            vod.vod_actor = '没有二级,只有一级链接直接嗅探播放';
            vod.vod_content = MY_URL;
            vod.vod_play_url = '嗅探播放$' + MY_URL.split('@@')[0];
        } else if (typeof p === 'object' && p !== null) {
            // 如果没有html，需要获取源码
            if (!html) {
                html = await request(this.input);
            }

            // 根据解析模式选择对应的解析函数
            let $pdfa;
            let $pdfh;
            let $pd;
            if (p.is_json) {
                log('[commonDetailListParse] 二级是json');
                html = dealJson(html);
                $pdfa = this.pjfa;
                $pdfh = this.pjfh;
                $pd = this.pj;
            } else {
                log('[commonDetailListParse] 二级默认jq');
                $pdfa = this.pdfa;
                $pdfh = this.pdfh;
                $pd = this.pd;
            }

            // 解析title字段
            if (p.title) {
                try {
                    let p1 = p.title.split(';');
                    vod.vod_name = $pdfh(html, p1[0]).replace(/\n|\t/g, '').trim();
                    let type_name = p1.length > 1 ? $pdfh(html, p1[1]).replace(/\n|\t/g, '').replace(/ /g, '').trim() : '';
                    vod.type_name = type_name || vod.type_name;
                } catch (e) {
                    log(`[commonDetailListParse] 解析title失败:${e.message}`);
                }
            }

            // 解析desc字段
            if (p.desc) {
                try {
                    let p1 = p.desc.split(';');
                    vod.vod_remarks = $pdfh(html, p1[0]).replace(/\n|\t/g, '').trim();
                    vod.vod_year = p1.length > 1 ? $pdfh(html, p1[1]).replace(/\n|\t/g, '').trim() : '';
                    vod.vod_area = p1.length > 2 ? $pdfh(html, p1[2]).replace(/\n|\t/g, '').trim() : '';
                    vod.vod_actor = p1.length > 3 ? $pdfh(html, p1[3]).replace(/\n|\t/g, '').trim() : '';
                    vod.vod_director = p1.length > 4 ? $pdfh(html, p1[4]).replace(/\n|\t/g, '').trim() : '';
                } catch (e) {
                    log(`[commonDetailListParse] 解析desc失败:${e.message}`);
                }
            }

            // 解析content字段
            if (p.content) {
                try {
                    let p1 = p.content.split(';');
                    vod.vod_content = $pdfh(html, p1[0]).replace(/\n|\t/g, '').trim();
                } catch (e) {
                    log(`[commonDetailListParse] 解析content失败:${e.message}`);
                }
            }

            // 解析img字段
            if (p.img) {
                try {
                    let p1 = p.img.split(';');
                    vod.vod_pic = $pd(html, p1[0], this.MY_URL);
                } catch (e) {
                    log(`[commonDetailListParse] 解析img失败:${e.message}`);
                }
            }

            let vod_play_from = '$$$';
            let playFrom = [];

            // 处理重定向
            if (p.重定向 && typeof p.重定向 === 'function') {
                log('[commonDetailListParse] 开始执行重定向代码');
                try {
                    html = await p.重定向.call(this);
                } catch (e) {
                    log(`[commonDetailListParse] 重定向执行失败:${e.message}`);
                }
            }

            // 处理tabs
            if (p.tabs) {
                if (typeof p.tabs === 'function') {
                    log('[commonDetailListParse] 开始执行tabs代码');
                    try {
                        const TABS = await p.tabs.call(this);
                        playFrom = TABS;
                    } catch (e) {
                        log(`[commonDetailListParse] tabs执行失败:${e.message}`);
                    }
                } else {
                    let p_tab = p.tabs.split(';')[0];
                    let vHeader = $pdfa(html, p_tab);
                    let tab_text = p.tab_text || 'body&&Text';
                    let new_map = {};
                    for (let v of vHeader) {
                        let v_title = $pdfh(v, tab_text).trim();
                        if (!v_title) {
                            v_title = '线路空';
                        }
                        if (moduleObject.tab_exclude && (new RegExp(moduleObject.tab_exclude)).test(v_title)) {
                            continue;
                        }
                        if (!new_map.hasOwnProperty(v_title)) {
                            new_map[v_title] = 1;
                        } else {
                            new_map[v_title] += 1;
                        }
                        if (new_map[v_title] > 1) {
                            v_title += Number(new_map[v_title] - 1);
                        }
                        playFrom.push(v_title);
                    }
                }
            } else {
                playFrom = ['道长在线'];
            }
            vod.vod_play_from = playFrom.join(vod_play_from);

            // 处理lists
            let vod_play_url = '$$$';
            let vod_tab_list = [];
            if (p.lists) {
                if (typeof p.lists === 'function') {
                    log('[commonDetailListParse] 开始执行lists代码');
                    try {
                        const LISTS = await p.lists.call(this);
                        for (let i in LISTS) {
                            if (LISTS.hasOwnProperty(i)) {
                                try {
                                    LISTS[i] = LISTS[i].map(it => it.split('$').slice(0, 2).join('$'));
                                } catch (e) {
                                    log(`[commonDetailListParse] 格式化LISTS发生错误:${e.message}`);
                                }
                            }
                        }
                        vod_play_url = LISTS.map(it => it.join('#')).join(vod_play_url);
                    } catch (e) {
                        log(`[commonDetailListParse] lists执行失败:${e.message}`);
                    }
                } else {
                    let list_text = p.list_text || 'body&&Text';
                    let list_url = p.list_url || 'a&&href';
                    let list_url_prefix = p.list_url_prefix || '';
                    let is_tab_js = typeof p.tabs === 'function';

                    for (let i = 0; i < playFrom.length; i++) {
                        let tab_name = playFrom[i];
                        let tab_ext = '';
                        if (typeof p.tabs === 'string' && p.tabs.split(';').length > 1 && !is_tab_js) {
                            tab_ext = p.tabs.split(';')[1];
                        }
                        let p1 = p.lists.replaceAll('#idv', tab_name).replaceAll('#id', i);
                        if (tab_ext) {
                            tab_ext = tab_ext.replaceAll('#idv', tab_name).replaceAll('#id', i);
                        }
                        let tabName = tab_ext ? $pdfh(html, tab_ext) : tab_name;

                        let new_vod_list = [];
                        if (typeof this.pdfl === 'function') {
                            new_vod_list = this.pdfl(html, p1, list_text, list_url, this.MY_URL);
                            if (list_url_prefix) {
                                new_vod_list = new_vod_list.map(it => it.split('$')[0] + '$' + list_url_prefix + it.split('$').slice(1).join('$'));
                            }
                        } else {
                            let vodList = [];
                            try {
                                vodList = $pdfa(html, p1);
                            } catch (e) {
                                log(`[commonDetailListParse] 解析vodList失败:${e.message}`);
                            }
                            for (let j = 0; j < vodList.length; j++) {
                                let it = vodList[j];
                                new_vod_list.push($pdfh(it, list_text).trim() + '$' + list_url_prefix + $pd(it, list_url, this.MY_URL));
                            }
                        }

                        if (new_vod_list.length > 0) {
                            new_vod_list = forceOrder(new_vod_list, '', x => x.split('$')[0]);
                        }

                        let vlist = new_vod_list.join('#');
                        vod_tab_list.push(vlist);
                    }
                    vod_play_url = vod_tab_list.join(vod_play_url);
                }
            }
            vod.vod_play_url = vod_play_url;
        }

        // 处理图片替换和来源
        if (moduleObject.图片替换) {
            if (typeof moduleObject.图片替换 === 'function') {
                // 异步函数处理
                try {
                    vod.vod_pic = await moduleObject.图片替换.call(this, vod.vod_pic);
                } catch (e) {
                    log(`[commonDetailListParse] 图片替换函数执行失败:${e.message}`);
                }
            } else if (typeof moduleObject.图片替换 === 'string' && moduleObject.图片替换.includes('=>')) {
                // 字符串替换处理
                let replace_from = moduleObject.图片替换.split('=>')[0];
                let replace_to = moduleObject.图片替换.split('=>')[1];
                vod.vod_pic = vod.vod_pic.replace(replace_from, replace_to);
            }
        }
        if (moduleObject.图片来源 && vod.vod_pic && vod.vod_pic.startsWith('http')) {
            vod.vod_pic = vod.vod_pic + moduleObject.图片来源;
        }

        // 处理vodDeal
        try {
            vod = vodDeal(vod, moduleObject);
        } catch (e) {
            log(`[commonDetailListParse] vodDeal发生错误:${e.message}`);
        }

        return vod;
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

async function detailParseObject(rule, url, vid, orId, fyclass) {
    let vod_name = '片名';
    let vod_pic = '';
    let vod_id = orId;

    if (rule.二级 === '*') {
        let extra = orId.split('@@');
        vod_name = extra.length > 1 ? extra[1] : vod_name;
        vod_pic = extra.length > 2 ? extra[2] : vod_pic;
    }

    let vod = {
        vod_id: vod_id,
        vod_name: vod_name,
        vod_pic: vod_pic,
        type_name: '类型',
        vod_year: '年份',
        vod_area: '地区',
        vod_remarks: '更新信息',
        vod_actor: '主演',
        vod_director: '导演',
        vod_content: '简介',
    };

    let p = rule.二级;
    let html = '';

    // 执行二级访问前代码
    if (rule.二级访问前) {
        try {
            log(`[detailParseObject] 尝试在二级访问前执行代码:${rule.二级访问前}`);
            // 这里需要在沙箱环境中执行，暂时跳过
        } catch (e) {
            log(`[detailParseObject] 二级访问前执行代码出现错误:${e.message}`);
        }
    }

    if (p === '*') {
        vod.vod_play_from = '道长在线';
        vod.vod_remarks = url;
        vod.vod_play_url = url + '$' + vod.vod_name;
    } else if (typeof p === 'object' && p !== null) {
        // 检查对象中是否有二级等于'*'的情况
        if (p['*']) {
            vod.vod_play_from = '道长在线';
            vod.vod_remarks = url;
            vod.vod_play_url = url + '$' + vod.vod_name;
            // 如果对象中只有'*'属性，直接返回
            if (Object.keys(p).length === 1) {
                const jsp = new jsoup(url);
                return {
                    TYPE: 'detail',
                    input: url,
                    vid: vid,
                    orId: orId,
                    fyclass: fyclass,
                    MY_URL: url,
                    HOST: rule.host,
                    fetch_params: deepCopy(rule.rule_fetch_params),
                    jsp: jsp,
                    pdfh: jsp.pdfh.bind(jsp),
                    pdfa: jsp.pdfa.bind(jsp),
                    pd: jsp.pd.bind(jsp),
                    pdfl: jsp.pdfl.bind(jsp),
                    pjfh: jsp.pjfh.bind(jsp),
                    pjfa: jsp.pjfa.bind(jsp),
                    pj: jsp.pj.bind(jsp),
                    vod: vod
                };
            }
        }
        let is_json = p.is_json;
        let is_jsp = p.is_jsp;
        let is_jq = p.is_jq;

        // 如果没有html，需要获取源码
        if (!html) {
            try {
                // 使用rule中的request方法
                html = await rule.request(url);
                if (!html) {
                    html = '';
                }
            } catch (e) {
                log(`[detailParseObject] 获取二级页面源码失败:${e.message}`);
                html = '';
            }
        }

        const jsp = new jsoup(url);

        // 处理各种解析模式
        if (is_json) {
            try {
                html = dealJson(html);
                let json = JSON.parse(html);
                // 使用jsonpath进行解析
                if (p.title) {
                    let titleResult = jsonpath.query(json, p.title);
                    if (titleResult && titleResult.length > 0) {
                        vod.vod_name = titleResult[0] || vod.vod_name;
                    }
                }
                if (p.desc) {
                    let descResult = jsonpath.query(json, p.desc);
                    if (descResult && descResult.length > 0) {
                        vod.vod_content = descResult[0] || vod.vod_content;
                    }
                }
                if (p.content) {
                    let contentResult = jsonpath.query(json, p.content);
                    if (contentResult && contentResult.length > 0) {
                        vod.vod_content = contentResult[0] || vod.vod_content;
                    }
                }
                if (p.img) {
                    let imgResult = jsonpath.query(json, p.img);
                    if (imgResult && imgResult.length > 0) {
                        vod.vod_pic = imgResult[0] || vod.vod_pic;
                    }
                }
            } catch (e) {
                log(`[detailParseObject] JSON解析失败:${e.message}`);
            }
        } else {
            // 普通HTML解析
            if (p.title) {
                try {
                    vod.vod_name = jsp.pdfh(html, p.title) || vod.vod_name;
                } catch (e) {
                    log(`[detailParseObject] 解析title失败:${e.message}`);
                }
            }
            if (p.desc) {
                try {
                    vod.vod_content = jsp.pdfh(html, p.desc) || vod.vod_content;
                } catch (e) {
                    log(`[detailParseObject] 解析desc失败:${e.message}`);
                }
            }
            if (p.content) {
                try {
                    vod.vod_content = jsp.pdfh(html, p.content) || vod.vod_content;
                } catch (e) {
                    log(`[detailParseObject] 解析content失败:${e.message}`);
                }
            }
            if (p.img) {
                try {
                    vod.vod_pic = jsp.pd(html, p.img, url) || vod.vod_pic;
                } catch (e) {
                    log(`[detailParseObject] 解析img失败:${e.message}`);
                }
            }
        }

        // 处理播放线路和播放列表
        let playFrom = [];
        let vod_play_from = '$$$';

        if (p.tabs) {
            try {
                if (is_json) {
                    // JSON模式下的tabs处理
                    let json = JSON.parse(html);
                    playFrom = jsonpath.query(json, p.tabs) || [];
                } else {
                    // HTML模式下的tabs处理
                    let tabs_list = jsp.pdfa(html, p.tabs);
                    playFrom = tabs_list.map(it => jsp.pdfh(it, 'Text'));
                }
            } catch (e) {
                log(`[detailParseObject] 解析tabs失败:${e.message}`);
                playFrom = ['道长在线'];
            }
        } else {
            playFrom = ['道长在线'];
        }

        vod.vod_play_from = playFrom.join(vod_play_from);

        // 处理播放列表
        let vod_play_url = '$$$';
        let vod_tab_list = [];

        if (p.lists) {
            let list_text = p.list_text || 'body&&Text';
            let list_url = p.list_url || 'a&&href';
            let list_url_prefix = p.list_url_prefix || '';

            for (let i = 0; i < playFrom.length; i++) {
                let tab_name = playFrom[i];
                let p1 = p.lists.replaceAll('#idv', tab_name).replaceAll('#id', i);
                let new_vod_list = [];

                try {
                    if (is_json) {
                        // JSON模式下的lists处理
                        let json = JSON.parse(html);
                        let vodList = jsonpath.query(json, p1) || [];
                        for (let item of vodList) {
                            let name = jsonpath.query(item, list_text)[0] || '';
                            let link = jsonpath.query(item, list_url)[0] || '';
                            if (name && link) {
                                new_vod_list.push(name.trim() + '$' + list_url_prefix + link);
                            }
                        }
                    } else {
                        // HTML模式下的lists处理
                        let vodList = jsp.pdfa(html, p1);
                        for (let it of vodList) {
                            let name = jsp.pdfh(it, list_text).trim();
                            let link = jsp.pd(it, list_url, url);
                            if (name && link) {
                                new_vod_list.push(name + '$' + list_url_prefix + link);
                            }
                        }
                    }
                } catch (e) {
                    log(`[detailParseObject] 解析lists失败:${e.message}`);
                }

                if (new_vod_list.length > 0) {
                    new_vod_list = forceOrder(new_vod_list, '', x => x.split('$')[0]);
                }

                let vlist = new_vod_list.join('#');
                vod_tab_list.push(vlist);
            }

            vod_play_url = vod_tab_list.join(vod_play_url);
        }

        vod.vod_play_url = vod_play_url;
    }

    // 处理图片替换和来源
    if (rule.图片替换) {
        if (typeof rule.图片替换 === 'function') {
            // 异步函数处理
            try {
                vod.vod_pic = await rule.图片替换.call(this, vod.vod_pic);
            } catch (e) {
                log(`[detailParseObject] 图片替换函数执行失败:${e.message}`);
            }
        } else if (typeof rule.图片替换 === 'string' && rule.图片替换.includes('=>')) {
            // 字符串替换处理
            let replace_from = rule.图片替换.split('=>')[0];
            let replace_to = rule.图片替换.split('=>')[1];
            vod.vod_pic = vod.vod_pic.replace(replace_from, replace_to);
        }
    }
    if (rule.图片来源 && vod.vod_pic && vod.vod_pic.startsWith('http')) {
        vod.vod_pic = vod.vod_pic + rule.图片来源;
    }

    if (!vod.vod_id || (orId.includes('$') && vod.vod_id !== orId)) {
        vod.vod_id = orId;
    }

    // 处理vodDeal
    try {
        vod = vodDeal(vod, rule);
    } catch (e) {
        log(`[detailParseObject] vodDeal发生错误:${e.message}`);
    }

    const jsp = new jsoup(url);
    return {
        TYPE: 'detail',
        input: url,
        vid: vid,
        orId: orId,
        fyclass: fyclass,
        MY_URL: url,
        HOST: rule.host,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pdfl: jsp.pdfl.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
        vod: vod // 添加解析好的vod对象
    };
}

async function detailParseAfter(vod) {
    return {
        list: [vod]
    }
}

async function searchParse(rule, wd, quick, pg) {
    if (rule.search_encoding) {
        if (rule.search_encoding.toLowerCase() !== 'utf-8') {
            // 按搜索编码进行编码
            wd = encodeStr(wd, rule.search_encoding);
        }
    } else if (rule.encoding && rule.encoding.toLowerCase() !== 'utf-8') {
        // 按全局编码进行编码
        wd = encodeStr(wd, rule.encoding);
    }
    if (!rule.searchUrl) {
        return
    }
    if (rule.searchNoPage && Number(pg) > 1) {
        // 关闭搜索分页
        return '{}'
    }
    let url = rule.searchUrl.replaceAll('**', wd);
    if (pg === 1 && url.includes('[') && url.includes(']') && !url.includes('#')) {
        url = url.split('[')[1].split(']')[0];
    } else if (pg > 1 && url.includes('[') && url.includes(']') && !url.includes('#')) {
        url = url.split('[')[0];
    }

    if (/fypage/.test(url)) {
        if (url.includes('(') && url.includes(')')) {
            let url_rep = url.match(/.*?\((.*)\)/)[1];
            let cnt_page = url_rep.replaceAll('fypage', pg);
            let cnt_pg = eval(cnt_page);
            url = url.replaceAll(url_rep, cnt_pg).replaceAll('(', '').replaceAll(')', '');
        } else {
            url = url.replaceAll('fypage', pg);
        }
    }
    const jsp = new jsoup(url);
    return {
        TYPE: 'search',
        MY_PAGE: pg,
        KEY: wd,
        input: url,
        MY_URL: url,
        HOST: rule.host,
        detailUrl: rule.detailUrl || '',
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }

}

async function searchParseAfter(rule, d, pg) {
    return {
        'page': parseInt(pg),
        'pagecount': 9999,
        'limit': Number(rule.limit) || 20,
        'total': 999999,
        'list': d,
    }
}

async function playParse(rule, flag, id, flags) {
    let url = id;
    if (!/http/.test(url)) {
        try {
            url = base64Decode(url);
            log('[playParse] id is base64 data');
        } catch (e) {
        }
    }
    url = decodeURIComponent(url);
    if (!/^http/.test(url)) {
        url = id;
    }
    if (id !== url) {
        log(`[playParse] ${id} => ${url}`);
    } else {
        log(`[playParse] ${url}`);
    }
    const jsp = new jsoup(url);
    return {
        TYPE: 'play',
        MY_FLAG: flag,
        flag: flag,
        input: url,
        MY_URL: url,
        HOST: rule.host,
        fetch_params: deepCopy(rule.rule_fetch_params),
        jsp: jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
    }
}

async function playParseAfter(rule, obj, playUrl, flag) {
    let common_play = {
        parse: SPECIAL_URL.test(playUrl) || /^(push:)/.test(playUrl) ? 0 : 1,
        url: playUrl,
        flag: flag,
        jx: tellIsJx(playUrl)
    };
    let lazy_play;
    if (!rule.play_parse || !rule.lazy) {
        lazy_play = common_play;
    } else if (rule.play_parse && rule.lazy && typeof (rule.lazy) === 'function') {
        try {
            lazy_play = typeof (obj) === 'object' ? obj : {
                parse: SPECIAL_URL.test(obj) || /^(push:)/.test(obj) ? 0 : 1,
                jx: tellIsJx(obj),
                url: obj
            };
        } catch (e) {
            log(`[playParseAfter] js免嗅错误:${e.message}`);
            lazy_play = common_play;
        }
    } else {
        lazy_play = common_play;
    }
    if (Array.isArray(rule.play_json) && rule.play_json.length > 0) { // 数组情况判断长度大于0
        let web_url = lazy_play.url;
        for (let pjson of rule.play_json) {
            if (pjson.re && (pjson.re === '*' || web_url.match(new RegExp(pjson.re)))) {
                if (pjson.json && typeof (pjson.json) === 'object') {
                    let base_json = pjson.json;
                    lazy_play = Object.assign(lazy_play, base_json);
                    break;
                }
            }
        }
    } else if (rule.play_json && !Array.isArray(rule.play_json)) { // 其他情况 非[] 判断true/false
        let base_json = {
            jx: 1,
            parse: 1,
        };
        lazy_play = Object.assign(lazy_play, base_json);
    } else if (!rule.play_json) { // 不解析传0
        let base_json = {
            jx: 0,
            parse: 1,
        };
        lazy_play = Object.assign(lazy_play, base_json);
    }
    return lazy_play
}

async function proxyParse(rule, params) {
    // log('proxyParse:', params);
    return {
        TYPE: 'proxy',
        input: params.url || '',
        MY_URL: params.url || '',
    }
}

export async function home(filePath, env, filter = 1) {
    // 使用filePath作为稳定的会话键
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'home');

    return await invokeMethod(filePath, env, 'class_parse', [filter], {
        input: '$.homeUrl',
        MY_URL: '$.homeUrl'
    });
}

export async function homeVod(filePath, env) {
    // homeVod使用相同的会话键，会自动复用home的缓存
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'homeVod');

    return await invokeMethod(filePath, env, '推荐', [], {
        input: '$.homeUrl',
        MY_URL: '$.homeUrl'
    });
}

export async function category(filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'category');

    return await invokeMethod(filePath, env, '一级', [tid, pg, filter, extend], {
        input: '$.url',
        MY_URL: '$.url'
    });
}

export async function detail(filePath, env, ids) {
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'detail');

    if (!Array.isArray(ids)) throw new Error('Parameter "ids" must be an array');
    return await invokeMethod(filePath, env, '二级', [ids], {
        input: `${ids[0]}`,
        MY_URL: `${ids[0]}`
    });
}

export async function search(filePath, env, wd, quick = 0, pg = 1) {
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'search');

    return await invokeMethod(filePath, env, '搜索', [wd, quick, pg], {
        input: '$.searchUrl',
        MY_URL: '$.searchUrl'
    });
}

export async function play(filePath, env, flag, id, flags) {
    const sessionKey = filePath;
    clearPageRequestCache(sessionKey, 'play');

    flags = flags || [];
    if (!Array.isArray(flags)) throw new Error('Parameter "flags" must be an array');
    return await invokeMethod(filePath, env, 'lazy', [flag, id, flags], {
        input: `${id}`,
        MY_URL: `${id}`,
    });
}

export async function proxy(filePath, env, params) {
    params = params || {};
    try {
        return await invokeMethod(filePath, env, 'proxy_rule', [deepCopy(params)], {
            input: `${params.url}`,
            MY_URL: `${params.url}`,
        });
    } catch (e) {
        return [500, 'text/plain', '代理规则错误:' + e.message]
    }
}

export async function action(filePath, env, action, value) {
    try {
        return await invokeMethod(filePath, env, 'action', [action, value], {});
    } catch (e) {
        return '动作规则错误:' + e.message
    }
}

export async function getRule(filePath, env) {
    return await invokeMethod(filePath, env, 'get_rule', [], {});
}

export async function jx(filePath, env, params) {
    params = params || {};
    try {
        const jxObj = await initJx(filePath, env); // 确保模块已初始化
        const lazy = await jxObj.lazy;
        const result = await lazy(params.url || '', params);
        // log(`[jx]: ${JSON.stringify(result)}`);
        return result;
    } catch (e) {
        return {code: 404, url: '', msg: `${filePath} 代理解析错误:${e.message}`, cost: ''}
    }
}

export async function getJx(filePath) {
    try {
        // 确保模块已初始化
        const jxObj = await initJx(filePath, {});
        // log('jxObj:', jxObj);
        return jxObj;
    } catch (e) {
        return {code: 403, error: `${filePath} 获取代理信息错误:${e.message}`}
    }
}

/**
 * 获取加密前的原始的js源文本
 * @param js_code
 */
export async function getOriginalJs(js_code) {
    // let current_match = /var rule|[\u4E00-\u9FA5]+|function|let |var |const |\(|\)|"|'/;
    let current_match = /var rule|function|let |var |const|class Rule|async|this\./;
    if (current_match.test(js_code)) {
        return js_code
    }
    log('[getOriginalJs] 密文源自动去除头信息...');
    js_code = await fileHeaderManager.removeHeader(js_code, {mode: 'top-comments', fileType: '.js'});
    let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
    let decode_content = '';

    function aes_decrypt(data) {
        // log(data);
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");
        let ciphertext = CryptoJS.enc.Base64.parse(data);
        let decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        // log(decrypted);
        return decrypted;
    }

    let error_log = false;

    function logger(text) {
        // log('[logger]:', text);
        if (error_log) {
            log('[getOriginalJs]', text);
        }
    }

    let decode_funcs = [
        (text) => {
            try {
                return ungzip(text)
            } catch (e) {
                logger('非gzip加密');
                return ''
            }
        },
        (text) => {
            try {
                return base64Decode(text)
            } catch (e) {
                logger('非b64加密');
                return ''
            }
        },
        (text) => {
            try {
                return aes_decrypt(text)
            } catch (e) {
                logger('非aes加密');
                return ''
            }
        },
        (text) => {
            try {
                return RSA.decode(text, rsa_private_key, null)
            } catch (e) {
                logger('非rsa加密');
                return ''
            }
        },
        // (text) => {
        //     try {
        //         return NODERSA.decryptRSAWithPrivateKey(text, RSA.getPrivateKey(rsa_private_key).replace(/RSA /g, ''), {
        //             options: {
        //                 environment: "browser",
        //                 encryptionScheme: 'pkcs1',
        //                 b: '1024'
        //             }
        //         });
        //     } catch (e) {
        //         log(e.message);
        //         return ''
        //     }
        // },
    ]
    let func_index = 0
    while (!current_match.test(decode_content)) {
        decode_content = decode_funcs[func_index](js_code);
        func_index++;
        if (func_index >= decode_funcs.length) {
            break;
        }
    }
    return decode_content
}

export const jsEncoder = {
    base64Encode,
    gzip,
    aes_encrypt: function (data) {
        // 定义密钥和初始向量，必须与解密时一致
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");

        // 使用AES加密
        let encrypted = CryptoJS.AES.encrypt(data, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        // 返回Base64编码的加密结果
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
        // 返回完整的加密结果（包括 IV 和其他元数据）
        // return encrypted.toString(); // Base64 格式
    },

    rsa_encode: function (text) {
        let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
        return RSA.encode(text, rsa_private_key, null);
    }
};

export const jsDecoder = {
    base64Decode,
    ungzip,
    aes_decrypt: function (data) {
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");
        let ciphertext = CryptoJS.enc.Base64.parse(data);
        let decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        return decrypted;
    },
    rsa_decode: function (text) {
        let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
        return RSA.decode(text, rsa_private_key, null);
    }
};


/**
 * 执行main函数
 * 示例  function main(text){return gzip(text)}
 * @param main_func_code
 * @param arg
 */
export async function runMain(main_func_code, arg) {
    let mainFunc = async function () {
        return ''
    };
    try {
        eval(main_func_code + '\nmainFunc=main;');
        return mainFunc(arg);
    } catch (e) {
        log(`[runMain] 执行main_func_code发生了错误:${e.message}`);
        return ''
    }
}

// 清理缓存函数  
export function clearAllCache() {
    const excludeList = ['APP模板配置'];
    let clearedCount = 0;

    // 清理moduleCache，跳过排除列表中的模块  
    for (const [key, value] of moduleCache.entries()) {
        let shouldSkip = false;

        // 检查是否在排除列表中  
        for (const excludeName of excludeList) {
            if (value.moduleObject && value.moduleObject.title &&
                value.moduleObject.title.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理模块缓存: ${value.moduleObject.title}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            moduleCache.delete(key);
            clearedCount++;
        }
    }

    // 清理ruleObjectCache，跳过排除列表中的模块  
    for (const [filePath, value] of ruleObjectCache.entries()) {
        let shouldSkip = false;

        for (const excludeName of excludeList) {
            if (filePath.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理规则缓存: ${filePath}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            ruleObjectCache.delete(filePath);
            clearedCount++;
        }
    }

    // 清理jxCache，跳过排除列表中的模块  
    for (const [key, value] of jxCache.entries()) {
        let shouldSkip = false;

        for (const excludeName of excludeList) {
            if (key.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理解析缓存: ${key}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            jxCache.delete(key);
            clearedCount++;
        }
    }

    log(`[clearAllCache] 已清理 ${clearedCount} 个模块缓存，排除了 ${excludeList.join(', ')} 相关缓存`);
}

/**
 * 强制正序算法
 * @param lists  待正序列表
 * @param key 正序键
 * @param option 单个元素处理函数
 * @returns {*}
 */
function forceOrder(lists, key, option) {
    let start = Math.floor(lists.length / 2);
    let end = Math.min(lists.length - 1, start + 1);
    if (start >= end) {
        return lists;
    }
    let first = lists[start];
    let second = lists[end];
    if (option && typeof (option) === 'function') {
        try {
            first = option(first);
            second = option(second);
        } catch (e) {
        }
    }
    if (key && typeof (key) === 'string' && key.trim()) {
        if (first.hasOwnProperty(key)) {
            first = first[key];
        }
        if (second.hasOwnProperty(key)) {
            second = second[key];
        }
    }
    // log(first,second);
    if (first && second) {
        if (/^\d+$/.test(first) && /^\d+$/.test(second)) {
            // 数字字符串转数字比较
            first = parseInt(first);
            second = parseInt(second);
        }
        // log(first,second,first>second);
        if (first > second) {
            return lists.reverse();
        }
    }
    return lists;
}

/**
 * vodDeal函数 - 处理播放源排序和重命名
 * @param vod
 * @param rule
 * @returns {*}
 */
function vodDeal(vod, rule) {
    if (!vod || !rule) return vod;

    try {
        // 线路排序
        if (rule.tab_order && rule.tab_order.length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            let urls = vod.vod_play_url ? vod.vod_play_url.split('$$$') : [];

            let orderedFroms = [];
            let orderedUrls = [];

            // 按照tab_order顺序排列
            rule.tab_order.forEach((orderItem) => {
                let index = froms.findIndex(from => from.includes(orderItem));
                if (index !== -1) {
                    orderedFroms.push(froms[index]);
                    if (urls[index]) {
                        orderedUrls.push(urls[index]);
                    }
                    froms.splice(index, 1);
                    urls.splice(index, 1);
                }
            });

            // 添加剩余的
            orderedFroms = orderedFroms.concat(froms);
            orderedUrls = orderedUrls.concat(urls);

            vod.vod_play_from = orderedFroms.join('$$$');
            vod.vod_play_url = orderedUrls.join('$$$');
        }

        // 线路重命名
        if (rule.tab_rename && Object.keys(rule.tab_rename).length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            const renameEntries = Object.entries(rule.tab_rename);
            froms = froms.map(from => {
                for (const [key, value] of renameEntries) {
                    if (from.includes(key)) {
                        return from.replace(key, value);
                    }
                }
                return from;
            });
            vod.vod_play_from = froms.join('$$$');
        }

        // 线路移除
        if (rule.tab_remove && rule.tab_remove.length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            let urls = vod.vod_play_url ? vod.vod_play_url.split('$$$') : [];

            let filteredFroms = [];
            let filteredUrls = [];

            froms.forEach((from, index) => {
                let shouldRemove = false;
                for (const removeItem of rule.tab_remove) {
                    if (from.includes(removeItem)) {
                        shouldRemove = true;
                        break;
                    }
                }
                if (!shouldRemove) {
                    filteredFroms.push(from);
                    if (urls[index]) {
                        filteredUrls.push(urls[index]);
                    }
                }
            });

            vod.vod_play_from = filteredFroms.join('$$$');
            vod.vod_play_url = filteredUrls.join('$$$');
        }

    } catch (e) {
        log(`[vodDeal] vodDeal处理失败: ${e.message}`);
    }

    return vod;
}

/**
 * 智能清理页面请求缓存
 * @param {string} sessionKey - 会话键（基于filePath）
 * @param {string} sessionType - 会话类型（home/homeVod/category等）
 * @param {boolean} force - 是否强制清理
 */
function clearPageRequestCache(sessionKey = null, sessionType = 'unknown', force = false) {
    if (!sessionKey) {
        pageRequestCache.clear();
        log('[clearPageRequestCache] 强制清理所有缓存');
        return;
    }

    const now = Date.now();

    // 对于home类型的请求，使用特殊的会话管理
    if (sessionType === 'home') {
        if (activeHomeSessions.has(sessionKey)) {
            log(`[clearPageRequestCache] 跳过清理，home会话正在进行: ${sessionKey}`);
            return;
        }
        // 标记home会话开始，记录时间戳
        activeHomeSessions.add(sessionKey);
        lastClearTime = now;
        pageRequestCache.clear();
        currentSessionId = sessionKey;
        log(`[clearPageRequestCache] 开始home会话，已清理缓存: ${sessionKey}`);

        // 10秒后自动清理会话标记，防止内存泄漏
        setTimeout(() => {
            activeHomeSessions.delete(sessionKey);
            log(`[clearPageRequestCache] 清理home会话标记: ${sessionKey}`);
        }, 10000);

    } else if (sessionType === 'homeVod') {
        // 检查是否有对应的home会话，或者距离上次清理时间很近（30秒内）
        if (activeHomeSessions.has(sessionKey) || (lastClearTime && (now - lastClearTime) < 30000)) {
            log(`[clearPageRequestCache] homeVod复用home会话缓存: ${sessionKey}`);
            return;
        }
        // 如果没有对应的home会话且时间间隔较长，则清理缓存
        pageRequestCache.clear();
        lastClearTime = now;
        currentSessionId = sessionKey;
        log(`[clearPageRequestCache] 独立homeVod会话，已清理缓存: ${sessionKey}`);

    } else {
        // 其他类型的请求直接清理缓存
        pageRequestCache.clear();
        lastClearTime = now;
        currentSessionId = sessionKey;
        log(`[clearPageRequestCache] ${sessionType}会话，已清理缓存: ${sessionKey}`);
    }
}

/**
 * 缓存请求函数，避免重复请求相同URL
 * @param {Function} requestFunc - 请求函数
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @param {string} cachePrefix - 缓存前缀
 * @returns {Promise<string>} - 请求结果
 */
async function cachedRequest(requestFunc, url, options = {}, cachePrefix = 'page') {
    const cacheKey = `${cachePrefix}:${md5(url + JSON.stringify(options))}`;

    // 检查缓存
    let cached = pageRequestCache.get(cacheKey);
    if (cached) {
        log(`[cachedRequest] 使用缓存的页面内容: ${url}`);
        return cached;
    }

    // 发起请求
    log(`[cachedRequest] 首次请求页面: ${url}`);
    try {
        const result = await requestFunc(url, options);
        if (result) {
            // 缓存结果，设置2分钟过期时间
            pageRequestCache.set(cacheKey, result);
            setTimeout(() => {
                pageRequestCache.delete(cacheKey);
                log(`[cachedRequest] 清除页面缓存: ${url}`);
            }, 2 * 60 * 1000);
        }
        return result;
    } catch (e) {
        log(`[cachedRequest] 请求失败: ${url}, 错误: ${e.message}`);
        return '';
    }
}

/**
 * 处理模板继承逻辑
 * @param {Object} rule - 规则对象
 * @param {Object} context - VM上下文
 */
async function handleTemplateInheritance(rule, context) {
    try {
        // 获取模板字典
        const muban = template.getMubans();

        // 处理自动模板匹配
        if (rule['模板'] === '自动') {
            try {
                let host_headers = rule['headers'] || {};
                const cacheKey = md5(rule.host + JSON.stringify(host_headers));

                // 先检查缓存中是否有HOST页面内容
                let host_html = hostHtmlCache.get(cacheKey);

                if (!host_html) {
                    // 缓存中没有，使用cachedRequest统一缓存管理
                    log(`[handleTemplateInheritance] 首次请求HOST页面: ${rule.host}`);
                    const getHostHtmlScript = new vm.Script(`
                        (async function() {
                            try {
                                // 使用cachedRequest来统一缓存管理，避免重复请求
                                const response = await cachedRequest(request, rule.host || HOST, { headers: ${JSON.stringify(host_headers)} }, 'host');
                                return response;
                            } catch (e) {
                                log('[handleTemplateInheritance] 获取HOST页面失败:', e.message);
                                return '';
                            }
                        })()
                    `);
                    host_html = await getHostHtmlScript.runInContext(context);

                    // 将结果也缓存到hostHtmlCache，保持兼容性
                    if (host_html) {
                        hostHtmlCache.set(cacheKey, host_html);
                        // 5分钟后清除缓存
                        setTimeout(() => {
                            hostHtmlCache.delete(cacheKey);
                            log(`[handleTemplateInheritance] 清除HOST页面缓存: ${rule.host}`);
                        }, 5 * 60 * 1000);
                    }
                } else {
                    log(`[handleTemplateInheritance] 使用缓存的HOST页面: ${rule.host}`);
                }

                let match_muban = '';
                let muban_keys = Object.keys(muban).filter(it => !/默认|短视2|采集1/.test(it));

                for (let muban_key of muban_keys) {
                    try {
                        // 检查模板是否有class_parse
                        if (muban[muban_key].class_parse) {
                            let class_parse = muban[muban_key].class_parse;

                            // 直接在context中执行class_parse代码进行测试
                            const testScript = new vm.Script(`
                                  (async function() {
                                      try {
                                          let html = ${JSON.stringify(host_html)};
                                          let p = ${JSON.stringify(class_parse)};
                                          let classes = [];
                                          
                                          // 处理class_parse字符串解析
                                          p = p.split(';');
                                          let p0 = p[0];
                                          let is_json = p0.startsWith('json:');
                                          p0 = p0.replace(/^(jsp:|json:|jq:)/, '');
                                          
                                          if (html) {
                                              let $pdfa, $pdfh, $pd;
                                              if (is_json) {
                                                  html = dealJson(html);
                                                  $pdfa = pjfa;
                                                  $pdfh = pjfh;
                                                  $pd = pj;
                                              } else {
                                                  $pdfa = pdfa;
                                                  $pdfh = pdfh;
                                                  $pd = pd;
                                              }
                                              
                                              if (is_json) {
                                                  try {
                                                      let list = $pdfa(html, p0);
                                                      if (list && list.length > 0) {
                                                          classes = list;
                                                      }
                                                  } catch (e) {
                                                      log('[handleTemplateInheritance] json分类解析失败:' + e.message);
                                                  }
                                              } else if (p.length >= 3) {
                                                  try {
                                                      let list = $pdfa(html, p0);
                                                      if (list && list.length > 0) {
                                                          for (const it of list) {
                                                              try {
                                                              //log('[handleTemplateInheritance] test it:',it);
                                                                  let name = $pdfh(it, p[1]);
                                                                  let url = $pd(it, p[2]);
                                                                  if (p.length > 3 && p[3]) {
                                                                      let exp = new RegExp(p[3]);
                                                                      let match = url.match(exp);
                                                                      if (match && match[1]) {
                                                                          url = match[1];
                                                                      }
                                                                  }
                                                                  if (name.trim()) {
                                                                      classes.push({
                                                                          'type_id': url.trim(),
                                                                          'type_name': name.trim()
                                                                      });
                                                                  }
                                                              } catch (e) {
                                                                  log('[handleTemplateInheritance] 分类列表解析元素失败:' + e.message);
                                                              }
                                                          }
                                                      }
                                                  } catch (e) {
                                                      log('[handleTemplateInheritance] 分类列表解析失败:' + e.message);
                                                  }
                                              }
                                          }
                                          
                                          return { class: classes };
                                      } catch (e) {
                                          log('[handleTemplateInheritance] 模板测试执行错误:', e.message);
                                          return { class: [] };
                                      }
                                  })()
                              `);

                            const host_data = await testScript.runInContext(context);

                            if (host_data.class && host_data.class.length > 0) {
                                match_muban = muban_key;
                                log(`[handleTemplateInheritance] 自动匹配模板:【${muban_key}】`);
                                break;
                            }
                        }
                    } catch (e) {
                        log(`[handleTemplateInheritance] 自动匹配模板:【${muban_key}】错误:${e.message}`);
                    }
                }

                if (match_muban) {
                    muban['自动'] = muban[match_muban];
                } else {
                    delete rule['模板'];
                }
            } catch (e) {
                log('[handleTemplateInheritance] 自动模板匹配失败:', e.message);
                delete rule['模板'];
            }
        }

        // 处理模板修改 - 在模板继承之前统一执行，避免重复执行
        if (rule['模板修改'] && typeof rule['模板修改'] === 'function' && rule.模板 && muban.hasOwnProperty(rule.模板)) {
            try {
                // 将muban传入函数，让模板修改能够修改模板
                await rule['模板修改'](muban);
            } catch (e) {
                log('[handleTemplateInheritance] 模板修改执行失败:', e.message);
            }
        }

        // 处理普通模板继承
        if (rule.模板 && muban.hasOwnProperty(rule.模板)) {
            log('[handleTemplateInheritance] 继承模板:' + rule.模板);

            // 使用Object.assign进行模板继承，模板属性在前，rule属性在后（rule属性优先级更高）
            const templateRule = muban[rule.模板];
            const originalRule = {...rule};
            Object.assign(rule, templateRule, originalRule);
        }

        // 清理模板相关属性
        delete rule['模板'];
        delete rule['模板修改'];

    } catch (error) {
        log('[handleTemplateInheritance] 模板继承处理失败:', error.message);
    }
}