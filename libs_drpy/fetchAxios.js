/**
 * FetchAxios - 基于原生fetch API的HTTP客户端
 * 提供类似axios的API接口，支持请求/响应拦截器、超时控制等功能
 */
import FormData from 'form-data';
import https from "https";

/**
 * FetchAxios类 - HTTP客户端实现
 * 基于原生fetch API，提供axios风格的接口
 */
class FetchAxios {
    /**
     * 构造函数
     * @param {Object} defaultConfig - 默认配置
     */
    constructor(defaultConfig = {}) {
        // 默认配置
        this.defaults = {
            baseURL: '',
            headers: {},
            timeout: 0,
            responseType: 'json', // json, text 或 arraybuffer
            withCredentials: false,
            httpsAgent: null,
            ...defaultConfig,
        };
        // 拦截器存储
        this.interceptors = {request: [], response: []};
    }

    /**
     * 添加请求拦截器
     * @param {Function} fn - 拦截器函数
     */
    useRequestInterceptor(fn) {
        this.interceptors.request.push(fn);
    }

    /**
     * 添加响应拦截器
     * @param {Function} fn - 拦截器函数
     */
    useResponseInterceptor(fn) {
        this.interceptors.response.push(fn);
    }

    /**
     * 发送HTTP请求
     * @param {string|Object} urlOrConfig - URL字符串或配置对象
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    async request(urlOrConfig, config = {}) {
        let finalConfig = {};
        // 判断调用方式
        if (typeof urlOrConfig === 'string') {
            // URL字符串方式调用
            finalConfig = {...this.defaults, ...config, url: this.defaults.baseURL + urlOrConfig};
        } else {
            // 配置对象方式调用
            finalConfig = {...this.defaults, ...urlOrConfig, url: this.defaults.baseURL + (urlOrConfig.url || '')};
        }

        // 执行请求拦截器
        for (const interceptor of this.interceptors.request) {
            finalConfig = await interceptor(finalConfig) || finalConfig;
        }

        // 拼接查询参数
        if (finalConfig.params) {
            const query = new URLSearchParams(finalConfig.params).toString();
            finalConfig.url += (finalConfig.url.includes('?') ? '&' : '?') + query;
        }

        // 设置超时控制
        const controller = new AbortController();
        if (finalConfig.timeout) setTimeout(() => controller.abort(), finalConfig.timeout);

        // 构建fetch选项
        const fetchOptions = {
            method: (finalConfig.method || 'GET').toUpperCase(),
            headers: {...finalConfig.headers},
            signal: controller.signal,
            credentials: finalConfig.withCredentials ? 'include' : 'same-origin',
            agent: finalConfig.httpsAgent || undefined,
        };

        // 处理请求体数据
        if (finalConfig.data instanceof FormData) {
            // FormData类型数据
            fetchOptions.body = finalConfig.data;
            Object.assign(fetchOptions.headers, finalConfig.data.getHeaders());
        } else if (finalConfig.data) {
            // 其他类型数据
            if (typeof finalConfig.data === 'object' && !fetchOptions.headers['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
            fetchOptions.body = fetchOptions.headers['Content-Type'] === 'application/json'
                ? JSON.stringify(finalConfig.data)
                : finalConfig.data;
        }

        try {
            // 发送HTTP请求
            const response = await fetch(finalConfig.url, fetchOptions);
            let responseData;
            
            // 根据响应类型处理数据
            if (finalConfig.responseType === 'json') {
                responseData = await response.json().catch(() => null);
            } else if (finalConfig.responseType === 'arraybuffer') {
                responseData = await response.arrayBuffer();
            } else {
                responseData = await response.text();
            }

            // 构建响应结果
            let result = {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                config: finalConfig,
                request: finalConfig.url,
            };

            // 执行响应拦截器
            for (const interceptor of this.interceptors.response) {
                result = await interceptor(result) || result;
            }

            // 检查响应状态
            if (!response.ok) throw result;
            return result;
        } catch (err) {
            // 抛出错误
            throw err;
        }
    }

    /**
     * GET请求
     * @param {string} url - 请求URL
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    get(url, config) {
        return this.request(url, {...config, method: 'GET'});
    }

    /**
     * POST请求
     * @param {string} url - 请求URL
     * @param {*} data - 请求数据
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    post(url, data, config) {
        return this.request(url, {...config, method: 'POST', data});
    }

    /**
     * PUT请求
     * @param {string} url - 请求URL
     * @param {*} data - 请求数据
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    put(url, data, config) {
        return this.request(url, {...config, method: 'PUT', data});
    }

    /**
     * DELETE请求
     * @param {string} url - 请求URL
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    delete(url, config) {
        return this.request(url, {...config, method: 'DELETE'});
    }
}

/**
 * 创建FetchAxios实例
 * @param {Object} defaultConfig - 默认配置
 * @returns {Function} 实例函数
 */
export function createInstance(defaultConfig) {
    const context = new FetchAxios(defaultConfig);

    // 创建可调用函数
    const instance = context.request.bind(context);

    // 挂载方法到实例
    ['get', 'post', 'put', 'delete', 'useRequestInterceptor', 'useResponseInterceptor'].forEach(method => {
        instance[method] = context[method].bind(context);
    });

    return instance;
}

// HTTPS代理 - 忽略证书错误
export const httpsAgent = new https.Agent({rejectUnauthorized: false});

/**
 * 创建HTTPS实例
 * @returns {Function} HTTPS实例
 */
export function createHttpsInstance() {
    return createInstance({
        headers: {'User-Agent': 'Mozilla/5.0'},
        timeout: 10000,
        responseType: 'arraybuffer',
        httpsAgent: httpsAgent
    });
}