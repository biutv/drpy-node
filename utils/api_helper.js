import {watch} from 'fs';
import path from 'path';

//添加JSON文件监听
let jsonWatcher = null;
let debounceTimers = new Map(); // 防抖计时器
export function startJsonWatcher(ENGINES, jsonDir) {
    if (process.env.NODE_ENV !== 'development') return;

    try {
        jsonWatcher = watch(jsonDir, {recursive: true}, (eventType, filename) => {
            if (filename && filename.endsWith('.json')) {
                // 清除之前的计时器
                if (debounceTimers.has(filename)) {
                    clearTimeout(debounceTimers.get(filename));
                }

                // 设置新的防抖计时器
                const timer = setTimeout(() => {
                    console.log(`${filename}文件已${eventType}，即将清除所有模块缓存`);
                    ENGINES.drpyS.clearAllCache();
                    debounceTimers.delete(filename);
                }, 100); // 100ms防抖延迟

                debounceTimers.set(filename, timer);
            }
        });

        console.log(`start json file hot reload success，listening path: ${jsonDir}`);
    } catch (error) {
        console.error('start json file listening failed with error:', error);
    }
}

export function getApiEngine(engines, moduleName, query, options) {
    // const adapt = query.adapt;
    const adapt = query.do; // js 或者 ds 都视为ds
    let apiEngine;
    let moduleDir;
    let _ext;

    switch (adapt) {
        case 'py':
            apiEngine = engines.hipy;
            moduleDir = options.pyDir;
            _ext = '.py';
            break;
        case 'cat':
            apiEngine = engines.catvod;
            moduleDir = options.catDir;
            _ext = '.js';
            break;
        case 'xbpq':
            apiEngine = engines.xbpq;
            moduleDir = options.xbpqDir;
            _ext = '.json';
            break;
        default:
            apiEngine = engines.drpyS;
            moduleDir = options.jsDir;
            _ext = '.js';
    }
    const modulePath = path.join(moduleDir, `${moduleName}${_ext}`);
    return {
        apiEngine,
        moduleDir,
        _ext,
        modulePath,
    }
}