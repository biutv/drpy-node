
import * as drpyS from '../../libs/drpyS.js';
import path from 'path';
import {fileURLToPath} from 'url';
import {existsSync} from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock server constants
const PORT = 5705;
const WsPORT = 5706;
const protocol = 'http';
const hostname = 'localhost:5705';

function getEnv(moduleName, query = {}) {
    const moduleExt = query.extend || '';
    const requestHost = `${protocol}://${hostname}`;
    const publicUrl = `${protocol}://${hostname}/public/`;
    const jsonUrl = `${protocol}://${hostname}/json/`;
    const httpUrl = `${protocol}://${hostname}/http`;
    const imageApi = `${protocol}://${hostname}/image`;
    const mediaProxyUrl = `${protocol}://${hostname}/mediaProxy`;
    const webdavProxyUrl = `${protocol}://${hostname}/webdav/`;
    const ftpProxyUrl = `${protocol}://${hostname}/ftp/`;
    const hostUrl = `${hostname.split(':')[0]}`;
    const wsName = hostname.replace(`:${PORT}`, `:${WsPORT}`);
    const fServer = null;
    
    const proxyUrl = `${protocol}://${hostname}/proxy/${moduleName}/?do=${query.do || 'ds'}&extend=${encodeURIComponent(moduleExt)}`;
    const getProxyUrl = function () {
        return proxyUrl
    };

    const env = {
        requestHost,
        proxyUrl,
        publicUrl,
        jsonUrl,
        httpUrl,
        imageApi,
        mediaProxyUrl,
        webdavProxyUrl,
        ftpProxyUrl,
        hostUrl,
        hostname,
        wsName,
        fServer,
        getProxyUrl,
        ext: moduleExt
    };
    
    env.getRule = async function (_moduleName) {
        const _modulePath = path.join(__dirname, '../js', `${_moduleName}.js`);
        if (!existsSync(_modulePath)) {
            return null;
        }
        const _env = getEnv(_moduleName);
        const RULE = await drpyS.getRuleObject(_modulePath, _env);
        
        RULE.callRuleFn = async function (_method, _args) {
             let invokeMethod = null;
             switch (_method) {
                case 'class_parse': invokeMethod = 'home'; break;
                case '推荐': invokeMethod = 'homeVod'; break;
                case '一级': invokeMethod = 'category'; break;
                case '二级': invokeMethod = 'detail'; break;
                case '搜索': invokeMethod = 'search'; break;
                case 'lazy': invokeMethod = 'play'; break;
                case 'proxy_rule': invokeMethod = 'proxy'; break;
                case 'action': invokeMethod = 'action'; break;
            }
            
            if (!invokeMethod) {
                if (typeof RULE[_method] !== 'function') {
                    return null
                } else {
                    return await RULE[_method](..._args);
                }
            }
            
            return await drpyS[invokeMethod](_modulePath, _env, ..._args);
        };
        
        return RULE;
    }
    
    return env;
}

// Test Status Reporter
const stats = {
    results: [],
    pass(name) { this.results.push({name, status: 'PASS'}); },
    fail(name, err) { this.results.push({name, status: 'FAIL', error: err}); },
    skip(name, reason) { this.results.push({name, status: 'SKIP', reason}); },
    summary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const skipped = this.results.filter(r => r.status === 'SKIP').length;
        
        console.log('\n\n==============================================');
        console.log('               TEST SUMMARY REPORT             ');
        console.log('==============================================');
        console.log(`Total Steps : ${total}`);
        console.log(`Passed      : ${passed}`);
        console.log(`Failed      : ${failed}`);
        console.log(`Skipped     : ${skipped}`);
        console.log('----------------------------------------------');
        
        this.results.forEach(r => {
            let statusIcon = r.status === 'PASS' ? '✅' : (r.status === 'FAIL' ? '❌' : '⚠️');
            let msg = `${statusIcon} [${r.status}] ${r.name}`;
            if (r.error) msg += ` - Error: ${r.error}`;
            if (r.reason) msg += ` - Reason: ${r.reason}`;
            console.log(msg);
        });
        console.log('==============================================\n');
    }
};

(async () => {
    // 设置目标模块路径
    const moduleName = '七猫小说[书]';
    const modulePath = path.join(__dirname, `../js/${moduleName}.js`);
    
    // Create environment
    const env = getEnv(moduleName);

    // Shared variables for test dependencies
    let homeResult;
    let cateResult;
    let searchResult;
    let detailResult;
    let detailUrl = '';

    try {
        console.log('Initializing module...');
        await drpyS.init(modulePath);

        // 1. 测试 Home/Category (分类列表)
        try {
            console.log('\n=== Testing Home/Category ===');
            homeResult = await drpyS.home(modulePath, env);
            console.log('Home Result:', JSON.stringify(homeResult.class.slice(0, 3))); // 只打印前3个分类
            
            if (homeResult && homeResult.class && homeResult.class.length > 0) {
                stats.pass('Home/Category');
            } else {
                throw new Error('No classes returned');
            }
        } catch (e) {
            stats.fail('Home/Category', e.message);
            // If home fails, we can't test category, but maybe search works?
        }

        // 2. 测试 Category Content (一级 - 分类内容)
        if (homeResult && homeResult.class && homeResult.class.length > 0) {
            try {
                // 使用第一个分类的 ID
                const classId = homeResult.class[0].type_id;
                console.log(`\n=== Testing Category Content (class_id=${classId}) ===`);
                // category(filePath, env, tid, pg, filter, extend)
                cateResult = await drpyS.category(modulePath, env, classId, 1);
                console.log('Category Result Count:', cateResult.list.length);
                if (cateResult.list.length > 0) {
                    console.log('First Item:', cateResult.list[0]);
                    stats.pass('Category Content');
                } else {
                    stats.fail('Category Content', 'No items in category');
                }
            } catch (e) {
                stats.fail('Category Content', e.message);
            }
        } else {
            stats.skip('Category Content', 'Dependency failed: Home/Category');
        }

        // 3. 测试 Search (搜索)
        try {
            const keyword = '剑来';
            console.log(`\n=== Testing Search (keyword=${keyword}) ===`);
            searchResult = await drpyS.search(modulePath, env, keyword);
            console.log('Search Result Count:', searchResult.list.length);
            if (searchResult.list.length > 0) {
                console.log('First Search Item:', searchResult.list[0]);
                stats.pass('Search');
            } else {
                stats.fail('Search', 'No search results found');
            }
        } catch (e) {
            stats.fail('Search', e.message);
        }

        // 4. 测试 Detail (二级 - 详情)
        // 优先使用搜索结果中的 URL (vod_id)，如果没有则尝试分类结果
        if (searchResult && searchResult.list && searchResult.list.length > 0) {
            detailUrl = searchResult.list[0].vod_id;
        } else if (cateResult && cateResult.list && cateResult.list.length > 0) {
            detailUrl = cateResult.list[0].vod_id;
        }

        if (detailUrl) {
            try {
                console.log(`\n=== Testing Detail (url=${detailUrl}) ===`);
                const detailOrList = await drpyS.detail(modulePath, env, [detailUrl]);
                
                if (detailOrList.list && Array.isArray(detailOrList.list)) {
                    detailResult = detailOrList.list[0];
                } else if (Array.isArray(detailOrList)) {
                    detailResult = detailOrList[0];
                } else {
                    detailResult = detailOrList;
                }
                
                if (!detailResult) {
                    throw new Error('Detail result is empty or invalid');
                }
                
                console.log('Detail Result:', {
                    vod_name: detailResult.vod_name,
                    vod_play_from: detailResult.vod_play_from,
                    // 截取 play_url 防止日志过长
                    vod_play_url: detailResult.vod_play_url ? (detailResult.vod_play_url.slice(0, 100) + '...') : 'N/A'
                });
                stats.pass('Detail');

            } catch (e) {
                stats.fail('Detail', e.message);
            }
        } else {
            stats.skip('Detail', 'No valid URL found from Search or Category results');
        }

        // 5. 测试 Play (播放/阅读)
        if (detailResult && detailResult.vod_play_url) {
            try {
                console.log('\n=== Testing Play ===');
                // 解析 vod_play_url 获取播放链接
                const flags = detailResult.vod_play_from.split('$$$');
                const urls = detailResult.vod_play_url.split('$$$');
                
                // 取第一个播放源的第一个章节
                const firstFlagUrlList = urls[0].split('#');
                const firstChapter = firstFlagUrlList[0]; 
                // 格式: "章节名$参数" -> "第一章$1747899@@123456@@第一章"
                const playUrl = firstChapter.split('$')[1]; 

                console.log(`Playing Chapter: ${firstChapter.split('$')[0]}`);
                console.log(`Play URL Params: ${playUrl}`);

                const playResult = await drpyS.play(modulePath, env, flags[0], playUrl);
                
                const logResult = {...playResult};
                if (logResult.url && logResult.url.startsWith('novel://')) {
                    logResult.url = logResult.url.slice(0, 100) + '... (truncated content)';
                }
                console.log('Play Result:', logResult);
                
                if (playResult.url || playResult.parse === 0) {
                     stats.pass('Play');
                } else {
                    stats.fail('Play', 'No play URL or content returned');
                }

            } catch (e) {
                stats.fail('Play', e.message);
            }
        } else {
            const reason = !detailResult ? 'Dependency failed: Detail' : 'No vod_play_url in detail';
            stats.skip('Play', reason);
        }

    } catch (error) {
        console.error('Critical Error during test initialization:', error);
    } finally {
        stats.summary();
    }
})();
