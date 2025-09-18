/**
 * HTTP请求工具模块
 * 
 * 该模块基于axios创建了预配置的HTTP客户端实例，提供了优化的网络请求功能。
 * 包含了连接池管理、SSL证书验证配置等网络优化设置。
 * 
 * @author drpy-node
 * @version 1.0.0
 */

import _axios from 'axios';
import https from 'https';
import http from 'http';

/**
 * 默认的HTTP请求客户端
 * 
 * 配置特性：
 * - 启用HTTP/HTTPS连接池（keepAlive: true）
 * - 禁用HTTPS证书验证（rejectUnauthorized: false）
 * - 适用于大多数网络请求场景
 */
const req = _axios.create({
    httpsAgent: new https.Agent({keepAlive: true, rejectUnauthorized: false}), // HTTPS代理配置
    httpAgent: new http.Agent({keepAlive: true}), // HTTP代理配置
});

/**
 * 简化版HTTP请求客户端
 * 
 * 配置特性：
 * - 仅禁用HTTPS证书验证
 * - 不启用连接池
 * - 适用于简单的一次性请求
 */
export const reqs = new _axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false // 禁用SSL证书验证
    })
});

// 导出默认的HTTP请求客户端
export default req;
