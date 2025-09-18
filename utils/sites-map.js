/**
 * 站点映射工具模块
 * 提供查询字符串解析和站点映射配置读取功能
 * @module sites-map
 */

import path from "path";
import {existsSync, readFileSync} from "fs";

/**
 * 将查询字符串解析为对象
 * @param {string} query - URL查询字符串
 * @returns {Object} 解析后的查询对象
 * @example
 * getQueryObj("name=test&id=123") // returns {name: "test", id: "123"}
 */
export function getQueryObj(query) {
    // 使用 URLSearchParams 解析查询字符串
    const searchParams = new URLSearchParams(query);

    // 创建空的查询对象
    const queryObject = {};
    // 遍历所有查询参数并添加到对象中
    for (const [key, value] of searchParams.entries()) {
        queryObject[key] = value;
    }
    return queryObject
}

/**
 * 读取并解析站点映射配置文件
 * @param {string} configDir - 配置文件目录路径
 * @returns {Object} 站点映射对象，键为站点名，值为配置数组
 * @description 
 * 配置文件格式：站点名@@查询字符串@@别名（可选）
 * 每行一个配置，支持同一站点多个配置
 */
export function getSitesMap(configDir) {
    // 初始化站点映射对象
    let SitesMap = {};
    // 构建配置文件路径
    let SitesMapPath = path.join(configDir, './map.txt');
    // 定义分隔符
    let splitStr = '@@';
    
    // 检查配置文件是否存在
    if (existsSync(SitesMapPath)) {
        try {
            // 读取配置文件内容
            let SitesMapText = readFileSync(SitesMapPath, 'utf-8');
            // 按行分割并过滤空行
            let SitesMapLines = SitesMapText.split('\n').filter(it => it);
            
            // 遍历每一行配置
            SitesMapLines.forEach((line) => {
                // 解析站点名（第一部分）
                let SitesMapKey = line.split(splitStr)[0].trim();
                // 如果站点名不存在，初始化为空数组
                if (!SitesMap.hasOwnProperty(SitesMapKey)) {
                    SitesMap[SitesMapKey] = [];
                }
                // 解析查询字符串（第二部分）
                let SitesMapQuery = line.split(splitStr)[1].trim();
                // 解析别名（第三部分，可选，默认为站点名）
                let SitesMapAlias = line.split(splitStr).length > 2 ? line.split(splitStr)[2].trim() : SitesMapKey;
                
                // 添加配置到站点映射中
                SitesMap[SitesMapKey].push({
                    alias: SitesMapAlias,           // 站点别名
                    queryStr: SitesMapQuery,        // 原始查询字符串
                    queryObject: getQueryObj(SitesMapQuery), // 解析后的查询对象
                });
            });
            return SitesMap
        } catch (e) {
            // 读取或解析失败时静默处理，返回空映射
        }
    }
    // 文件不存在或处理失败时返回空映射
    return SitesMap
}
