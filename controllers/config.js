/**
 * 配置控制器模块
 * 
 * 功能描述：
 * - 负责生成和管理各种配置JSON文件
 * - 处理站点配置、解析器配置、直播配置等
 * - 支持订阅模式和健康检查
 * - 提供Fastify路由接口
 * 
 * 主要功能：
 * 1. 站点配置生成 - 扫描JS源文件生成站点配置
 * 2. 解析器配置 - 管理视频解析器配置
 * 3. 直播配置 - 处理直播源配置
 * 4. 播放器配置 - 管理播放器相关配置
 * 5. 订阅管理 - 支持多订阅码模式
 * 6. 健康检查 - 过滤失效源站
 * 
 * API接口：
 * - GET /index - 获取索引配置
 * - GET /config* - 获取完整配置（支持订阅和健康检查）
 * 
 * @author drpy-node
 * @version 1.0.0
 */

// 文件系统操作模块
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'fs';
import {readFile} from 'fs/promises';
import path from 'path';

// 核心功能模块
import * as drpyS from '../libs/drpyS.js';
import '../libs_drpy/jinja.js'

// 工具函数模块
import {naturalSort, urljoin, updateQueryString} from '../utils/utils.js'
import {md5} from "../libs_drpy/crypto-util.js";
import {ENV} from "../utils/env.js";
import FileHeaderManager from "../utils/fileHeaderManager.js";
import {extractNameFromCode} from "../utils/python.js";

// 验证和映射模块
import {validateBasicAuth, validatePwd} from "../utils/api_validate.js";
import {getSitesMap} from "../utils/sites-map.js";
import {getParsesDict} from "../utils/file.js";
import batchExecute from '../libs_drpy/batchExecute.js';

// 解构获取编码器
const {jsEncoder} = drpyS;

/**
 * 解析扩展参数
 * 尝试将字符串解析为JSON对象或数组，失败则返回原字符串
 * 
 * @param {string} str - 待解析的字符串
 * @returns {any} 解析后的对象、数组或原字符串
 */
function parseExt(str) {
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) {
            return parsed;
        }
    } catch (e) {
        // 忽略JSON解析错误
    }
    return str;
}

/**
 * 记录扩展参数
 * 将对象或数组转换为JSON字符串用于日志记录
 * 
 * @param {any} _ext - 扩展参数
 * @returns {string} 格式化后的字符串
 */
function logExt(_ext) {
    return Array.isArray(_ext) || typeof _ext == "object" ? JSON.stringify(_ext) : _ext
}

/**
 * 生成站点配置JSON
 * 扫描指定目录下的JS文件，生成站点配置信息
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.jsDir - JS源文件目录
 * @param {string} options.dr2Dir - DR2源文件目录
 * @param {string} options.pyDir - Python源文件目录
 * @param {string} options.catDir - Cat源文件目录
 * @param {string} options.configDir - 配置文件目录
 * @param {string} options.jsonDir - JSON配置目录
 * @param {string} options.subFilePath - 订阅文件路径
 * @param {string} options.rootDir - 根目录路径
 * @param {string} requestHost - 请求主机地址
 * @param {Object|null} sub - 订阅配置对象
 * @param {string} pwd - 访问密码
 * @returns {Promise<Object>} 包含站点配置的对象
 */
// 工具函数：生成 JSON 数据
async function generateSiteJSON(options, requestHost, sub, pwd) {
    const jsDir = options.jsDir;
    const dr2Dir = options.dr2Dir;
    const pyDir = options.pyDir;
    const catDir = options.catDir;
    const configDir = options.configDir;
    const jsonDir = options.jsonDir;
    const subFilePath = options.subFilePath;
    const rootDir = options.rootDir;

    // 读取JS源文件目录
    const files = readdirSync(jsDir);
    let valid_files = files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .js 文件
    let sort_list = [];
    
    // 确定排序文件路径
    let sort_file = path.join(path.dirname(subFilePath), `./order_common.html`);
    if (!existsSync(sort_file)) {
        sort_file = path.join(path.dirname(subFilePath), `./order_common.example.html`);
    }
    
    // 处理订阅过滤和排序
    if (sub) {
        // 根据订阅模式过滤文件
        if (sub.mode === 0) {
            valid_files = valid_files.filter(it => (new RegExp(sub.reg || '.*')).test(it));
        } else if (sub.mode === 1) {
            valid_files = valid_files.filter(it => !(new RegExp(sub.reg || '.*')).test(it));
        }

        // 使用自定义排序文件
        if (sub.sort) {
            sort_file = path.join(path.dirname(subFilePath), `./${sub.sort}.html`);
            if (!existsSync(sort_file)) {
                sort_file = path.join(path.dirname(subFilePath), `./${sub.sort}.example.html`);
            }
        }
    }
    
    // 读取排序配置
    if (existsSync(sort_file)) {
        console.log('sort_file:', sort_file);
        let sort_file_content = readFileSync(sort_file, 'utf-8');
        // console.log(sort_file_content)
        sort_list = sort_file_content.split('\n').filter(it => it.trim()).map(it => it.trim());
        // console.log(sort_list);
    }
    let sites = [];

    // 以下为自定义APP模板部分
    try {
        const templateConfigPath = path.join(jsonDir, './App模板配置.json');
        if (existsSync(templateConfigPath)) {
            const templateContent = readFileSync(templateConfigPath, 'utf-8');
            const templateConfig = JSON.parse(templateContent);
            // 生成模板配置站点
            sites = Object.entries(templateConfig).filter(([key]) => valid_files.includes(`${key}[模板].js`))
                .flatMap(([key, config]) =>
                    Object.entries(config)
                        .filter(([name]) => name !== "示例")
                        .map(([name]) => ({
                            key: `drpyS_${name}_${key}`,
                            name: `${name}[M](${key.replace('App', '').toUpperCase()})`,
                            type: 4,
                            api: `${requestHost}/api/${key}[模板]${pwd ? `?pwd=${pwd}` : ''}`,
                            searchable: 1,
                            filterable: 1,
                            quickSearch: 0,
                            ext: `../json/App模板配置.json$${name}`
                        })));
        }
    } catch (e) {
        console.error('读取App模板配置失败:', e.message);
    }
    // 以上为自定义APP[模板]配置自动添加代码

// ... existing code ...

    // 环境变量配置
    let link_jar = '';
    let enableRuleName = ENV.get('enable_rule_name', '0') === '1'; // 是否启用规则名称
    let enableOldConfig = Number(ENV.get('enable_old_config', '0')); // 是否启用旧配置
    let isLoaded = await drpyS.isLoaded(); // 检查drpyS是否已加载
    let forceHeader = Number(process.env.FORCE_HEADER) || 0; // 是否强制重新读取头部信息
    let dr2ApiType = Number(process.env.DR2_API_TYPE) || 0; // 0 ds里的api 1壳子内置
    
    // 成人内容过滤
    if (ENV.get('hide_adult') === '1') {
        valid_files = valid_files.filter(it => !(new RegExp('\\[[密]\\]|密+')).test(it));
    }
    
    // 获取站点映射配置
    let SitesMap = getSitesMap(configDir);
    let mubanKeys = Object.keys(SitesMap);
    
    // 排除模板后缀的DS源
    valid_files = valid_files.filter(it => !/\[模板]\.js$/.test(it));
    log(`开始生成ds的t4配置，jsDir:${jsDir},源数量: ${valid_files.length}`);
    
    // 创建批处理任务
    const tasks = valid_files.map((file) => {
        return {
            func: async ({file, jsDir, requestHost, pwd, drpyS, SitesMap, jsEncoder}) => {
                const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                let api = `${requestHost}/api/${baseName}`;  // 使用请求的 host 地址，避免硬编码端口
                if (pwd) {
                    api += `?pwd=${pwd}`;
                }
                
                // 初始化规则对象
                let ruleObject = {
                    searchable: 0, // 固定值
                    filterable: 0, // 固定值
                    quickSearch: 0, // 固定值
                };
                let ruleMeta = {...ruleObject};
                
                // 读取或生成文件头部信息
                const filePath = path.join(jsDir, file);
                const header = await FileHeaderManager.readHeader(filePath);
                
                if (!header || forceHeader) {
                    try {
                        ruleObject = await drpyS.getRuleObject(filePath);
                    } catch (e) {
                        throw new Error(`Error parsing rule object for file: ${file}, ${e.message}`);
                    }
                    
                    // 更新规则元数据
                    Object.assign(ruleMeta, {
                        title: ruleObject.title,
                        author: ruleObject.author,
                        类型: ruleObject.类型 || '影视',
                        searchable: ruleObject.searchable,
                        filterable: ruleObject.filterable,
                        quickSearch: ruleObject.quickSearch,
                        more: ruleObject.more,
                        logo: ruleObject.logo,
                        lang: 'ds',
                    });
                    
                    // 写入头部信息缓存
                    await FileHeaderManager.writeHeader(filePath, ruleMeta);
                } else {
                    Object.assign(ruleMeta, header);
                }
                
                // 记录文件加载信息
                if (!isLoaded) {
                    const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                    console.log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                }
                
                // 设置标题
                ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                let fileSites = [];
                const isMuban = mubanKeys.includes(baseName);
                
                // 处理不同类型的源
                if (baseName === 'push_agent') {
                    // 推送代理源
                    let key = 'push_agent';
                    let name = `${ruleMeta.title}(DS)`;
                    fileSites.push({key, name});
                } else if (isMuban && SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                    // 模板源
                    SitesMap[baseName].forEach((it) => {
                        let key = `drpyS_${it.alias}`;
                        let name = `${it.alias}(DS)`;
                        let ext = it.queryObject.type === 'url' ? it.queryObject.params : it.queryStr;
                        if (ext) {
                            ext = jsEncoder.gzip(ext);
                        }
                        fileSites.push({key, name, ext});
                    });
                } else if (isMuban) {
                    return
                } else {
                    // 普通源
                    let key = `drpyS_${ruleMeta.title}`;
                    let name = `${ruleMeta.title}(DS)`;
                    fileSites.push({key, name});
                }

                // 生成站点配置
                fileSites.forEach((fileSite) => {
                    const site = {
                        key: fileSite.key,
                        name: fileSite.name,
                        type: 4, // 固定值
                        api,
                        ...ruleMeta,
                        ext: fileSite.ext || "", // 固定为空字符串
                    };
                    sites.push(site);
                });
            },
            param: {file, jsDir, requestHost, pwd, drpyS, SitesMap, jsEncoder},
            id: file,
        };
    });

    // 批处理监听器
    const listener = {
        func: (param, id, error, result) => {
            if (error) {
                console.error(`Error processing file ${id}:`, error.message);
            } else {
                // console.log(`Successfully processed file ${id}:`, result);
            }
        },
        param: {}, // 外部参数可以在这里传入
    };

    // 执行批处理任务
    await batchExecute(tasks, listener);

    // 根据用户是否启用dr2源去生成对应配置
    const enable_dr2 = ENV.get('enable_dr2', '1');
    if ((enable_dr2 === '1' || enable_dr2 === '2')) {
        const dr2_files = readdirSync(dr2Dir);
        let dr2_valid_files = dr2_files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .js 文件
        console.log(`开始生成dr2配置，dr2Dir:${dr2Dir},源数量: ${dr2_valid_files.length}, 启用模式: ${enable_dr2 === '1' ? 'T3配置' : 'T4风格API配置'}`);

        // 创建DR2批处理任务
        const dr2_tasks = dr2_valid_files.map((file) => {
            return {
                func: async ({file, dr2Dir, requestHost, pwd, drpyS, SitesMap}) => {
                    const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                    let ruleObject = {
                        searchable: 0, // 固定值
                        filterable: 0, // 固定值
                        quickSearch: 0, // 固定值
                    };
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(dr2Dir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    
                    // 处理DR2文件头部信息
                    if (!header || forceHeader) {
                        try {
                            ruleObject = await drpyS.getRuleObject(path.join(filePath));
                        } catch (e) {
                            throw new Error(`Error parsing rule object for file: ${file}, ${e.message}`);
                        }
                        Object.assign(ruleMeta, {
                            title: ruleObject.title,
                            author: ruleObject.author,
                            类型: ruleObject.类型 || '影视',
                            searchable: ruleObject.searchable,
                            filterable: ruleObject.filterable,
                            quickSearch: ruleObject.quickSearch,
                            more: ruleObject.more,
                            logo: ruleObject.logo,
                            lang: 'dr2',
                        });
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        console.log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    // 处理DR2源类型
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(DR2)`;
                        fileSites.push({key, name});
                    } else if (SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        SitesMap[baseName].forEach((it) => {
                            let key = `drpy2_${it.alias}`;
                            let name = `${it.alias}(DR2)`;
                            fileSites.push({key, name, queryStr: it.queryStr});
                        });
                    } else {
                        let key = `drpy2_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(DR2)`;
                        fileSites.push({key, name});
                    }

                    // 生成DR2站点配置
                    fileSites.forEach((fileSite) => {
                        if (enable_dr2 === '1') {
                            // dr2ApiType=0 使用接口drpy2 dr2ApiType=1 使用壳子内置的drpy2
                            let api = dr2ApiType ? `assets://js/lib/drpy2.js` : `${requestHost}/public/drpy/drpy2.min.js`;
                            let ext = `${requestHost}/js/${file}`;
                            if (pwd) {
                                ext += `?pwd=${pwd}`;
                            }
                            // 处理传参源的ext
                            if (fileSite.queryStr) {
                                ext = updateQueryString(ext, fileSite.queryStr);
                            }
                            // 模式1：只启用dr2的T3配置
                            const site = {
                                key: fileSite.key,
                                name: fileSite.name,
                                type: 3, // 固定值

                                api: fileSite.ext || "", // 固定为空字符串
                            };
                            sites.push(site);
                        } else if (enable_dr2 === '2') {
                            // 模式2：只启用T3脚本的T4风格API配置
                            const t4site = {
                                key: fileSite.key,
                                name: fileSite.name,
                                type: 4, // 固定值

                                api: `${requestHost}/api/${baseName}`,
                                ...ruleMeta,
                                ext: "", // 固定为空字符串
                            };
                            // 添加isdr2参数到API URL
                            if (pwd) {
                                t4site.api += `?pwd=${pwd}&do=dr`;
                            } else {
                                t4site.api += `?do=dr`;
                            }

                            // 处理传参源的API参数
                            if (fileSite.queryStr) {
                                const separator = t4site.api.includes('?') ? '&' : '?';
                                site.api += `${separator}extend=${encodeURIComponent(fileSite.queryStr)}`;
                            }

                            sites.push(t4site);
                        }
                    });
                },
                param: {file, dr2Dir, requestHost, pwd, drpyS, SitesMap},
                id: file,
            };
        });

        await batchExecute(dr2_tasks, listener);

    }

    // 根据用户是否启用py源去生成对应配置
    const enable_py = ENV.get('enable_py', '1');
    if (enable_py === '1' || enable_py === '2') {
        const py_files = readdirSync(pyDir);
        const api_type = enable_py === '1' ? 3 : 4;
        let py_valid_files = py_files.filter((file) => file.endsWith('.py') && !file.startsWith('_') && !file.startsWith('base_')); // 筛选出不是 "_" 开头的 .py 文件
        // log(py_valid_files);
        log(`开始生成python的T${api_type}配置，pyDir:${pyDir},源数量: ${py_valid_files.length}`);

        const py_tasks = py_valid_files.map((file) => {
            return {
                func: async ({file, pyDir, requestHost, pwd, SitesMap}) => {
                    const baseName = path.basename(file, '.py'); // 去掉文件扩展名
                    const extJson = path.join(pyDir, baseName + '.json');
                    let api = enable_py === '1' ? `${requestHost}/py/${file}` : `${requestHost}/api/${baseName}?do=py`;  // 使用请求的 host 地址，避免硬编码端口
                    let ext = existsSync(extJson) ? `${requestHost}/py/${file}` : '';
                    if (pwd) {
                        api += api_type === 3 ? '?' : '&';
                        api += `pwd=${pwd}`;
                        if (ext) {
                            ext += `?pwd=${pwd}`;
                        }
                    }
                    let ruleObject = {
                        searchable: 1, // 固定值
                        filterable: 1, // 固定值
                        quickSearch: 1, // 固定值
                    };
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(pyDir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    // console.log('py header:', header);
                    if (!header || forceHeader) {
                        const fileContent = await readFile(filePath, 'utf-8');
                        const title = extractNameFromCode(fileContent) || baseName;
                        Object.assign(ruleMeta, {
                            title: title,
                            lang: 'hipy',
                        });
                        // console.log('py ruleMeta:', ruleMeta);
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        console.log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    ext = ext || ruleMeta.ext || '';
                    const isMuban = mubanKeys.includes(baseName) || /^(APP|getapp3)/i.test(baseName);
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(hipy)`;
                        fileSites.push({key, name, ext});
                    } else if (isMuban && SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        // console.log(SitesMap[baseName]);
                        SitesMap[baseName].forEach((it) => {
                            let key = `hipy_py_${it.alias}`;
                            let name = `${it.alias}(hipy)`;
                            let _ext = it.queryStr;
                            if (!enableOldConfig) {
                                _ext = parseExt(_ext);
                            }
                            console.log(`[HIPY-${baseName}] alias name: ${name},typeof _ext:${typeof _ext},_ext: ${logExt(_ext)}`);
                            fileSites.push({key, name, ext: _ext});
                        });
                    } else if (isMuban) {
                        return
                    } else {
                        let key = `hipy_py_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(hipy)`;
                        fileSites.push({key, name, ext});
                    }

                    fileSites.forEach((fileSite) => {
                        const site = {
                            key: fileSite.key,
                            name: fileSite.name,
                            type: api_type, // 固定值
                            api,
                            ...ruleMeta,
                            ext: fileSite.ext || "", // 固定为空字符串
                        };
                        sites.push(site);
                    });
                },
                param: {file, pyDir, requestHost, pwd, SitesMap},
                id: file,
            };
        });

        await batchExecute(py_tasks, listener);

    }
    const enable_cat = ENV.get('enable_cat', '1');
    // 根据用户是否启用cat源去生成对应配置
    if (enable_cat === '1' || enable_cat === '2') {
        const cat_files = readdirSync(catDir);
        const api_type = enable_cat === '1' ? 3 : 4;
        let cat_valid_files = cat_files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .py 文件
        // log(py_valid_files);
        log(`开始生成catvod的T${api_type}配置，catDir:${catDir},源数量: ${cat_valid_files.length}`);

        const cat_tasks = cat_valid_files.map((file) => {
            return {
                func: async ({file, catDir, requestHost, pwd, SitesMap}) => {
                    const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                    const extJson = path.join(catDir, baseName + '.json');
                    const isT3 = enable_cat === '1' || baseName.includes('[B]');
                    let api = isT3 ? `${requestHost}/cat/${file}` : `${requestHost}/api/${baseName}?do=cat`;  // 使用请求的 host 地址，避免硬编码端口
                    let ext = existsSync(extJson) ? `${requestHost}/cat/${file}` : '';

                    if (pwd) {
                        api += isT3 ? '?' : '&';
                        api += `pwd=${pwd}`;
                        if (ext) {
                            ext += `?pwd=${pwd}`;
                        }
                    }
                    let ruleObject = {
                        searchable: 1, // 固定值
                        filterable: 1, // 固定值
                        quickSearch: 1, // 固定值
                    };
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(catDir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    // console.log('py header:', header);
                    if (!header || forceHeader) {
                        const fileContent = await readFile(filePath, 'utf-8');
                        const title = extractNameFromCode(fileContent) || baseName;
                        Object.assign(ruleMeta, {
                            title: title,
                            lang: 'cat',
                        });
                        // console.log('py ruleMeta:', ruleMeta);
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        console.log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    ext = ext || ruleMeta.ext || '';
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(cat)`;
                        fileSites.push({key, name, ext});
                    } else if (SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        SitesMap[baseName].forEach((it) => {
                            let key = `catvod_${it.alias}`;
                            let name = `${it.alias}(cat)`;
                            let _ext = it.queryStr;
                            if (!enableOldConfig) {
                                _ext = parseExt(_ext);
                            }
                            console.log(`[CAT-${baseName}] alias name: ${name},typeof _ext:${typeof _ext},_ext: ${logExt(_ext)}`);
                            fileSites.push({key, name, ext: _ext});
                        });
                    } else {
                        let key = `catvod_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(cat)`;
                        fileSites.push({key, name, ext});
                    }

                    fileSites.forEach((fileSite) => {
                        const site = {
                            key: fileSite.key,
                            name: fileSite.name,
                            type: isT3 ? 3 : api_type, // 固定值
                            api,
                            ...ruleMeta,
                            ext: fileSite.ext || "", // 固定为空字符串
                        };
                        sites.push(site);
                    });
                },
                param: {file, catDir, requestHost, pwd, SitesMap},
                id: file,
            };
        });

        await batchExecute(cat_tasks, listener);

    }

    // 根据用户是否启用挂载数据源去生成对应配置
    if (ENV.get('enable_link_data', '0') === '1') {
        log(`开始挂载外部T4数据`);
        let link_sites = [];
        let link_url = ENV.get('link_url');
        let enable_link_push = ENV.get('enable_link_push', '0');
        let enable_link_jar = ENV.get('enable_link_jar', '0');
        try {
            let link_data = readFileSync(path.join(rootDir, './data/settings/link_data.json'), 'utf-8');
            let link_config = JSON.parse(link_data);
            link_sites = link_config.sites.filter(site => site.type = 4);
            
            // 处理外部JAR文件
            if (link_config.spider && enable_link_jar === '1') {
                let link_spider_arr = link_config.spider.split(';');
                link_jar = urljoin(link_url, link_spider_arr[0]);
                if (link_spider_arr.length > 1) {
                    link_jar = [link_jar].concat(link_spider_arr.slice(1)).join(';')
                }
                log(`开始挂载外部T4 Jar: ${link_jar}`);
            }
            
            // 处理外部站点配置
            link_sites.forEach((site) => {
                if (site.key === 'push_agent' && enable_link_push !== '1') {
                    return
                }
                // 处理相对路径API
                if (site.api && !site.api.startsWith('http')) {
                    site.api = urljoin(link_url, site.api)
                }
                // 处理相对路径扩展配置
                if (site.ext && site.ext.startsWith('.')) {
                    site.ext = urljoin(link_url, site.ext)
                }
                // 推送代理覆盖处理
                if (site.key === 'push_agent' && enable_link_push === '1') { // 推送覆盖
                    let pushIndex = sites.findIndex(s => s.key === 'push_agent');
                    if (pushIndex > -1) {
                        sites[pushIndex] = site;
                    } else {
                        sites.push(site);
                    }
                } else {
                    sites.push(site);
                }
            });
        } catch (e) {
            // 忽略外部数据读取错误
        }
    }

    // 订阅再次处理别名的情况
    if (sub) {
        if (sub.mode === 0) {
            sites = sites.filter(it => (new RegExp(sub.reg || '.*')).test(it.name));
        } else if (sub.mode === 1) {
            sites = sites.filter(it => !(new RegExp(sub.reg || '.*')).test(it.name));
        }
    }
    // 青少年模式再次处理自定义别名的情况
    if (ENV.get('hide_adult') === '1') {
        sites = sites.filter(it => !(new RegExp('\\[[密]\\]|密+')).test(it.name));
    }
    
    // 自然排序处理
    sites = naturalSort(sites, 'name', sort_list);
    return {sites, spider: link_jar};
}

/**
 * 生成解析器配置JSON
 * 扫描解析器目录，生成视频解析器配置信息
 * 
 * @param {string} jxDir - 解析器文件目录
 * @param {string} requestHost - 请求主机地址
 * @returns {Promise<Object>} 包含解析器配置的对象
 */
async function generateParseJSON(jxDir, requestHost) {
    const files = readdirSync(jxDir);

    const jx_files = files.filter((file) => file.endsWith('.js') && !file.startsWith('_')) // 筛选出不是 "_" 开头的 .js 文件
    const jx_dict = getParsesDict(requestHost);
    let parses = [];
    const tasks = jx_files.map((file) => {
        return {
            func: async ({file, jxDir, requestHost, drpyS}) => {
                const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                const api = `${requestHost}/parse/${baseName}?url=`;  // 使用请求的 host 地址，避免硬编码端口

                let jxObject = {
                    type: 1, // 固定值
                    ext: {
                        flag: [
                            "qiyi",
                            "imgo",
                            "爱奇艺",
                            "奇艺",
                            "qq",
                            "qq 预告及花絮",
                            "腾讯",
                            "youku",
                            "优酷",
                            "pptv",
                            "PPTV",
                            "letv",
                            "乐视",
                            "leshi",
                            "mgtv",
                            "芒果",
                            "sohu",
                            "xigua",
                            "fun",
                            "风行"
                        ]
                    },
                    header: {
                        "User-Agent": "Mozilla/5.0"
                    }
                };
                try {
                    let _jxObject = await drpyS.getJx(path.join(jxDir, file));
                    jxObject = {...jxObject, ..._jxObject};
                } catch (e) {
                    throw new Error(`Error parsing jx object for file: ${file}, ${e.message}`);
                }

                parses.push({
                    name: baseName,
                    url: jxObject.url || api,
                    type: jxObject.type,
                    ext: jxObject.ext,
                    header: jxObject.header
                });
            },
            param: {file, jxDir, requestHost, drpyS},
            id: file,
        };
    });

    const listener = {
        func: (param, id, error, result) => {
            if (error) {
                console.error(`Error processing file ${id}:`, error.message);
            } else {
                // console.log(`Successfully processed file ${id}:`, result);
            }
        },
        param: {}, // 外部参数可以在这里传入
    };
    await batchExecute(tasks, listener);
    let sorted_parses = naturalSort(parses, 'name', ['JSON并发', 'JSON合集', '虾米', '奇奇']);
    let sorted_jx_dict = naturalSort(jx_dict, 'name', ['J', 'W']);
    parses = sorted_parses.concat(sorted_jx_dict);
    return {parses};
}

function generateLivesJSON(requestHost) {
    // 直播源配置
    const lives = [
        {
            name: "直播",
            type: 0,
            url: `${requestHost}/lives/iptv.m3u`,
            epg: "",
            logo: ""
        }
    ];
    return {lives};
}

function generatePlayerJSON(configDir, requestHost) {
    let playerConfig = {};
    let playerConfigPath = path.join(configDir, './player.json');
    if (existsSync(playerConfigPath)) {
        try {
            playerConfig = JSON.parse(readFileSync(playerConfigPath, 'utf-8'))
        } catch (e) {
            // 忽略配置文件读取错误
        }
    }
    return playerConfig
}

function getSubs(subFilePath) {
    let subs = [];
    try {
        const subContent = readFileSync(subFilePath, 'utf-8');
        subs = JSON.parse(subContent)
    } catch (e) {
        console.log(`读取订阅失败:${e.message}`);
    }
    return subs
}

/**
 * Fastify插件 - 配置控制器
 * 注册配置相关的路由处理器
 * 
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {

    /**
     * 获取索引配置
     * GET /index
     * 返回预生成的index.json配置文件
     */
    fastify.get('/index', {preHandler: validatePwd}, async (request, reply) => {
        if (!existsSync(options.indexFilePath)) {
            reply.code(404).send({error: 'index.json not found'});
            return;
        }

        const content = readFileSync(options.indexFilePath, 'utf-8');
        reply.send(JSON.parse(content));
    });

    /**
     * 获取完整配置
     * GET /config*
     * 动态生成完整的配置JSON，支持订阅和健康检查
     * 
     * 查询参数：
     * - pwd: 访问密码
     * - sub: 订阅码
     * - healthy: 健康检查标志（1启用）
     */
    // 接口：返回配置 JSON，同时写入 index.json
    fastify.get('/config*', {preHandler: [validatePwd, validateBasicAuth]}, async (request, reply) => {
        let t1 = (new Date()).getTime();
        const query = request.query; // 获取 query 参数
        const pwd = query.pwd || '';
        const sub_code = query.sub || '';
        const healthy = query.healthy || ''; // 新增healthy参数
        const cat_sub_code = ENV.get('cat_sub_code', 'all');
        const must_sub_code = Number(ENV.get('must_sub_code', '0')) || 0;
        const cfg_path = request.params['*']; // 捕获整个路径
        try {
            // 获取主机名，协议及端口
            const protocol = request.headers['x-forwarded-proto'] || (request.socket.encrypted ? 'https' : 'http');  // http 或 https
            const hostname = request.hostname;  // 主机名，不包含端口
            const port = request.socket.localPort;  // 获取当前服务的端口
            console.log(`cfg_path:${cfg_path},port:${port}`);
            
            // 判断是否为外部访问
            let not_local = cfg_path.startsWith('/1') || cfg_path.startsWith('/index');
            let requestHost = not_local ? `${protocol}://${hostname}` : `http://127.0.0.1:${options.PORT}`; // 动态生成根地址
            let requestUrl = not_local ? `${protocol}://${hostname}${request.url}` : `http://127.0.0.1:${options.PORT}${request.url}`; // 动态生成请求链接
            
            // 处理特殊文件请求的工具函数
            const getFilePath = (cfgPath, rootDir, fileName) => path.join(rootDir, `data/cat/${fileName}`);
            const processContent = (content, cfgPath, requestUrl, requestHost) => {
                const $config_url = requestUrl.replace(cfgPath, `/1?sub=${cat_sub_code}&healthy=1&pwd=${process.env.API_PWD || ''}`);
                return content.replaceAll('$config_url', $config_url).replaceAll('$host', requestHost);
            }

            // 处理JavaScript文件请求
            const handleJavaScript = (cfgPath, requestUrl, requestHost, options, reply) => {
                const fileMap = {
                    'index.js': 'index.js',
                    'index.config.js': 'index.config.js'
                };

                for (const [key, fileName] of Object.entries(fileMap)) {
                    if (cfgPath.includes(key)) {
                        const filePath = getFilePath(cfgPath, options.rootDir, fileName);
                        let content = readFileSync(filePath, 'utf-8');
                        content = processContent(content, cfgPath, requestUrl, requestHost);
                        return reply.type('application/javascript;charset=utf-8').send(content);
                    }
                }
            };

            // 处理JavaScript MD5校验请求
            const handleJsMd5 = (cfgPath, requestUrl, options, reply) => {
                const fileMap = {
                    'index.js': 'index.js',
                    'index.config.js': 'index.config.js'
                };

                for (const [key, fileName] of Object.entries(fileMap)) {
                    if (cfgPath.includes(key)) {
                        const filePath = getFilePath(cfgPath, options.rootDir, fileName);
                        let content = readFileSync(filePath, 'utf-8');
                        content = processContent(content, cfgPath, requestUrl);
                        const contentHash = md5(content);
                        console.log(`${fileName} contentHash:`, contentHash);
                        return reply.type('text/plain;charset=utf-8').send(contentHash);
                    }
                }
            };
            
            // 处理JavaScript文件请求
            if (cfg_path.endsWith('.js')) {
                return handleJavaScript(cfg_path, requestUrl, requestHost, options, reply);
            }

            // 处理JavaScript MD5校验请求
            if (cfg_path.endsWith('.js.md5')) {
                return handleJsMd5(cfg_path, requestUrl, options, reply);
            }
            
            // 处理订阅验证
            let sub = null;
            if (sub_code) {
                let subs = getSubs(options.subFilePath);
                sub = subs.find(it => it.code === sub_code);
                console.log('sub:', sub);
                if (sub && sub.status === 0) {
                    return reply.status(500).send({error: `此订阅码:【${sub_code}】已禁用`});
                } else if (!sub && must_sub_code) {
                    return reply.status(500).send({error: `此订阅码:【${sub_code}】不存在`});
                }
            } else if (!sub_code && must_sub_code) {
                return reply.status(500).send({error: `缺少订阅码参数`});
            }

            // 生成站点配置
            let siteJSON = await generateSiteJSON(options, requestHost, sub, pwd);

            // 处理healthy参数，过滤失效源
            if (healthy === '1') {
                const reportPath = path.join(options.rootDir, 'data', 'source-checker', 'report.json');
                if (existsSync(reportPath)) {
                    try {
                        const reportContent = readFileSync(reportPath, 'utf-8');
                        const reportData = JSON.parse(reportContent);

                        // 获取失效源的key列表
                        const failedKeys = new Set();
                        if (reportData.sources && Array.isArray(reportData.sources)) {
                            reportData.sources.forEach(source => {
                                if (source.status === 'error') {
                                    failedKeys.add(source.key);
                                }
                            });
                        }

                        // 过滤掉失效的源
                        if (failedKeys.size > 0) {
                            siteJSON.sites = siteJSON.sites.filter(site => !failedKeys.has(site.key));
                            console.log(`Filtered out ${failedKeys.size} failed sources, remaining: ${siteJSON.sites.length}`);
                        }
                    } catch (error) {
                        console.error('Failed to process health report:', error.message);
                    }
                }
            }

            // 生成各种配置
            const parseJSON = await generateParseJSON(options.jxDir, requestHost);
            const livesJSON = generateLivesJSON(requestHost);
            const playerJSON = generatePlayerJSON(options.configDir, requestHost);
            
            // 合并配置对象
            const configObj = {sites_count: siteJSON.sites.length, ...playerJSON, ...siteJSON, ...parseJSON, ...livesJSON};
            if (!configObj.spider) {
                configObj.spider = playerJSON.spider
            }
            
            // 生成配置字符串
            const configStr = JSON.stringify(configObj, null, 2);
            
            // 写入配置文件（非Vercel环境）
            if (!process.env.VERCEL) { // Vercel 环境不支持写文件，关闭此功能
                writeFileSync(options.indexFilePath, configStr, 'utf8'); // 写入 index.json
                if (cfg_path === '/1') {
                    writeFileSync(options.customFilePath, configStr, 'utf8'); // 写入自定义配置
                }
            }
            
            // 计算处理耗时并返回结果
            let t2 = (new Date()).getTime();
            let cost = t2 - t1;
            reply.send(Object.assign({cost}, configObj));
        } catch (error) {
            reply.status(500).send({error: 'Failed to generate site JSON', details: error.message});
        }
    });

    done();
};
