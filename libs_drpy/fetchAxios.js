import FormData from 'form-data';
import https from "https";

class FetchAxios {
    constructor(defaultConfig = {}) {
        this.defaults = {
            baseURL: '',
            headers: {},
            timeout: 0,
            responseType: 'json', // json 或 text
            withCredentials: false,
            httpsAgent: null,
            ...defaultConfig,
        };
        this.interceptors = {request: [], response: []};
    }

    useRequestInterceptor(fn) {
        this.interceptors.request.push(fn);
    }

    useResponseInterceptor(fn) {
        this.interceptors.response.push(fn);
    }

    async request(urlOrConfig, config = {}) {
        let finalConfig = {};
        // 判断调用方式
        if (typeof urlOrConfig === 'string') {
            finalConfig = {...this.defaults, ...config, url: this.defaults.baseURL + urlOrConfig};
        } else {
            finalConfig = {...this.defaults, ...urlOrConfig, url: this.defaults.baseURL + (urlOrConfig.url || '')};
        }

        // 执行请求拦截器
        for (const interceptor of this.interceptors.request) {
            finalConfig = await interceptor(finalConfig) || finalConfig;
        }

        // 拼接 params
        if (finalConfig.params) {
            const query = new URLSearchParams(finalConfig.params).toString();
            finalConfig.url += (finalConfig.url.includes('?') ? '&' : '?') + query;
        }

        const controller = new AbortController();
        if (finalConfig.timeout) setTimeout(() => controller.abort(), finalConfig.timeout);

        const fetchOptions = {
            method: (finalConfig.method || 'GET').toUpperCase(),
            headers: {...finalConfig.headers},
            signal: controller.signal,
            credentials: finalConfig.withCredentials ? 'include' : 'same-origin',
            agent: finalConfig.httpsAgent || undefined,
        };

        if (finalConfig.data instanceof FormData) {
            fetchOptions.body = finalConfig.data;
            Object.assign(fetchOptions.headers, finalConfig.data.getHeaders());
        } else if (finalConfig.data) {
            if (typeof finalConfig.data === 'object' && !fetchOptions.headers['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
            fetchOptions.body = fetchOptions.headers['Content-Type'] === 'application/json'
                ? JSON.stringify(finalConfig.data)
                : finalConfig.data;
        }

        try {
            const response = await fetch(finalConfig.url, fetchOptions);
            let responseData;
            if (finalConfig.responseType === 'json') {
                responseData = await response.json().catch(() => null);
            } else {
                responseData = await response.text();
            }

            let result = {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                config: finalConfig,
                request: finalConfig.url,
            };

            for (const interceptor of this.interceptors.response) {
                result = await interceptor(result) || result;
            }

            if (!response.ok) throw result;
            return result;
        } catch (err) {
            throw err;
        }
    }

    get(url, config) {
        return this.request(url, {...config, method: 'GET'});
    }

    post(url, data, config) {
        return this.request(url, {...config, method: 'POST', data});
    }

    put(url, data, config) {
        return this.request(url, {...config, method: 'PUT', data});
    }

    delete(url, config) {
        return this.request(url, {...config, method: 'DELETE'});
    }
}

// 创建 axios 实例函数
export function createInstance(defaultConfig) {
    const context = new FetchAxios(defaultConfig);

    // 创建可调用函数
    const instance = context.request.bind(context);

    // 挂载方法
    ['get', 'post', 'put', 'delete', 'useRequestInterceptor', 'useResponseInterceptor'].forEach(method => {
        instance[method] = context[method].bind(context);
    });

    return instance;
}

// 忽略 HTTPS 证书错误
export const httpsAgent = new https.Agent({rejectUnauthorized: false});

export function createHttpsInstance() {
    return createInstance({
        headers: {'User-Agent': 'Mozilla/5.0'},
        timeout: 10000,
        responseType: 'text',
        httpsAgent: httpsAgent
    });
}