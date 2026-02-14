import fs from "fs-extra";
import { resolvePath, isSafePath } from "../utils/pathHelper.js";
import { decodeDsSource } from "../utils/dsHelper.js";
import { exec } from "child_process";
import util from "util";
import path from "path";
import vm from "vm";

const execPromise = util.promisify(exec);

// Import project utils
let jsoup, req;
try {
    const htmlParser = await import("../../libs_drpy/htmlParser.js");
    jsoup = htmlParser.jsoup;
    const reqModule = await import("../../utils/req.js");
    req = reqModule.default;
} catch (e) {
    console.error("Warning: Failed to import project utils in spiderTools:", e.message);
}

export const list_sources = async () => {
    const jsSourcesPath = resolvePath("spider/js");
    const catvodSourcesPath = resolvePath("spider/catvod");
    
    let jsSources = [];
    let catvodSources = [];

    if (await fs.pathExists(jsSourcesPath)) {
        jsSources = (await fs.readdir(jsSourcesPath)).filter(f => f.endsWith('.js'));
    }
    if (await fs.pathExists(catvodSourcesPath)) {
        catvodSources = (await fs.readdir(catvodSourcesPath)).filter(f => f.endsWith('.js'));
    }

    return {
        content: [{
            type: "text",
            text: JSON.stringify({
                "spider/js": jsSources,
                "spider/catvod": catvodSources
            }, null, 2)
        }]
    }
};

export const get_routes_info = async () => {
    const indexControllerPath = resolvePath("controllers/index.js");
    if (!await fs.pathExists(indexControllerPath)) {
        return { content: [{ type: "text", text: "controllers/index.js not found" }] };
    }
    const content = await fs.readFile(indexControllerPath, "utf-8");
    const lines = content.split('\n');
    const registered = lines
      .filter(l => l.trim().startsWith('fastify.register('))
      .map(l => l.trim());
    
    return {
        content: [{
            type: "text",
            text: JSON.stringify({
                file: "controllers/index.js",
                registered_controllers: registered
            }, null, 2)
        }]
    }
};

export const fetch_spider_url = async (args) => {
    if (!req) return { isError: true, content: [{ type: "text", text: "req module not loaded" }] };
    const { url, options } = args;
    try {
        const config = options || {};
        if (!config.method) config.method = 'GET';
        const res = await req(url, config);
        
        const result = {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            data: res.data
        };
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(result, null, 2)
            }]
        };
    } catch (e) {
        return {
            isError: true,
            content: [{ type: "text", text: `Fetch Error: ${e.message}\nResponse: ${e.response ? JSON.stringify(e.response.data) : 'No response'}` }]
        };
    }
};

export const debug_spider_rule = async (args) => {
    if (!jsoup) return { isError: true, content: [{ type: "text", text: "jsoup module not loaded" }] };
    const { html, url, rule, mode, baseUrl, options } = args;
    let content = html;
    let finalUrl = baseUrl || url;

    if (url && !content) {
        if (!req) return { isError: true, content: [{ type: "text", text: "req module not loaded for url fetch" }] };
        try {
            const res = await req(url, options || {});
            content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            if (!finalUrl) finalUrl = url;
        } catch (e) {
            return {
                isError: true,
                content: [{ type: "text", text: `Failed to fetch URL: ${e.message}` }]
            };
        }
    }

    if (!content) {
        return {
            isError: true,
            content: [{ type: "text", text: "Please provide 'html' content or 'url' to fetch." }]
        };
    }

    try {
        const j = new jsoup(finalUrl || '');
        let result;
        if (mode === 'pdfa') {
            result = j.pdfa(content, rule);
        } else if (mode === 'pdfh') {
            result = j.pdfh(content, rule);
        } else if (mode === 'pd') {
            result = j.pd(content, rule);
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    mode,
                    rule,
                    count: Array.isArray(result) ? result.length : (result ? 1 : 0),
                    result
                }, null, 2)
            }]
        };
    } catch (e) {
        return {
            isError: true,
            content: [{ type: "text", text: `Parsing Error: ${e.message}` }]
        };
    }
};

export const get_spider_template = async () => {
    const template = `/*
* @File     : drpy-node spider template
* @Author   : user
* @Date     : ${new Date().toISOString().split('T')[0]}
* @Comments : 
*/

var rule = {
    // 影视|漫画|小说
    类型: '影视',
    // 源标题
    title: 'Site Name',
    // 源主域名，可以自动处理后续链接的相对路径
    host: 'https://example.com',
    // 源主页链接，作为推荐的this.input
    homeUrl: '/latest/',
    // 源一级列表链接 (fyclass=分类, fypage=页码)
    url: '/category/fyclass/page/fypage', 
    // 源搜索链接 (**=关键词, fypage=页码)
    searchUrl: '/search?wd=**&pg=fypage',
    // 允许搜索(1)、允许快搜(1)、允许筛选(1)
    searchable: 2, 
    quickSearch: 0, 
    filterable: 1, 
    // 源默认请求头、调用await request如果参数二不填会自动添加
    headers: {
        'User-Agent': 'MOBILE_UA', 
    },
    // 接口访问超时时间
    timeout: 5000,
    // 静态分类名称
    class_name: 'Movie&TV&Anime',
    // 静态分类id
    class_url: '1&2&3',
    // 动态分类获取 列表;标题;链接;正则提取 (可选)
    // class_parse: '#side-menu:lt(1) li;a&&Text;a&&href;com/(.*?)/',
    
    // 是否需要调用免嗅lazy函数 (服务器解析播放)
    play_parse: true,
    // 免嗅lazy执行函数 (如果play_parse为true则需要)
    lazy: '',
    // 首页推荐显示数量
    limit: 6,
    // 是否双层列表定位,默认false
    double: true,
    
    // 推荐列表解析: 列表;标题;图片;描述;链接
    推荐: '.recommend .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 一级列表解析: 列表;标题;图片;描述;链接
    一级: '.list .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 二级详情解析 (字典模式)
    二级: {
        "title": "h1&&Text",
        "img": ".poster img&&src",
        "desc": ".desc&&Text",
        "content": ".content&&Text",
        "tabs": ".tabs span", // 线路列表
        "lists": ".playlists ul", // 选集列表
    },
    // 搜索结果解析: 列表;标题;图片;描述;链接
    搜索: '.search-result .item;a&&title;img&&src;.remarks&&Text;a&&href',

    /**
     * 高级函数用法 (如需使用，请解除注释并替换相应字段)
     * Advanced Function Usage (Uncomment and replace fields if needed)
     */
    
    /*
    // 动态获取域名 (优先级最高)
    hostJs: async function () {
        let {HOST} = this;
        // ... perform logic ...
        return HOST;
    },
    
    // 预处理 (初始化时执行一次，用于获取cookie等)
    预处理: async function () {
        let {HOST} = this;
        // ... perform logic ...
        return HOST;
    },
    
    // 自定义免嗅函数 (play_parse: true 时调用)
    lazy: async function () {
        let {input} = this;
        // ... perform logic to get real url ...
        return {
            url: input,
            parse: 0, // 0: 直接播放, 1: 嗅探
            header: {} // 可选
        };
    },
    
    // 动态分类解析 (替代 class_name/class_url)
    class_parse: async function () {
        let {input} = this;
        // ... parse input ...
        return {
            class: [{type_name: '电影', type_id: '1'}],
            filters: {} // 可选
        };
    },
    
    // 自定义推荐列表解析 (替代字符串规则)
    推荐: async function () {
        let {input} = this;
        // ... parse input ...
        return [{
            vod_name: 'Title',
            vod_pic: 'Image',
            vod_remarks: 'Desc',
            vod_id: 'Url'
        }];
    },
    
    // 自定义一级列表解析
    一级: async function () {
        let {input} = this;
        // ... parse input ...
        return [{
            vod_name: 'Title',
            vod_pic: 'Image',
            vod_remarks: 'Desc',
            vod_id: 'Url'
        }];
    },
    
    // 自定义二级详情解析
    二级: async function () {
        let {input} = this;
        // ... parse input ...
        return {
            vod_name: 'Title',
            vod_pic: 'Image',
            type_name: 'Category',
            vod_year: 'Year',
            vod_area: 'Area',
            vod_actors: 'Actors',
            vod_director: 'Director',
            vod_content: 'Content',
            vod_play_from: 'Line1$$$Line2', // 线路名
            vod_play_url: 'Ep1$Url1#Ep2$Url2$$$Ep1$Url1...', // 播放列表
        };
    },
    
    // 自定义搜索解析
    搜索: async function () {
        let {input} = this;
        // ... parse input ...
        return [{
            vod_name: 'Title',
            vod_pic: 'Image',
            vod_remarks: 'Desc',
            vod_id: 'Url'
        }];
    },
    */
}
`;
    return {
        content: [{
            type: "text",
            text: template
        }]
    }
};

export const get_drpy_libs_info = async () => {
    const info = {
        "Global Objects": [
            "request(url, options) / req(url, options) - HTTP Request", 
            "post(url, options) - HTTP POST",
            "pdfa(html, rule) - Parse List (Cheerio)", 
            "pdfh(html, rule) - Parse Html (Cheerio)", 
            "pd(html, rule) - Parse Url (Cheerio + urljoin)",
            "log(msg) / print(msg) - Logging", 
            "setItem(key, value) / getItem(key) - Storage",
            "urljoin(base, path) - URL Joining",
            "local - Local storage object",
            "input - Current input (url or content)",
            "HOST - Current source host",
            "rule - Current rule object"
        ],
        "Parsing Rules": [
            "Format: selector;attr1;attr2...",
            "pdfa (list): Returns array. Example: '.list li;a&&title;a&&href'",
            "pdfh (single): Returns string. Example: 'h1&&Text'",
            "pd (url): Returns resolved URL.",
            "Special syntax: && (separator), || (backup), * (all), :eq(n) (index)",
            "Attributes: Text, Html, href (auto-resolves), src, data-*, etc."
        ]
    };
    return {
        content: [{
            type: "text",
            text: JSON.stringify(info, null, 2)
        }]
    }
};

export const validate_spider = async (args) => {
    const filePath = args?.path;
    if (!filePath || !isSafePath(filePath)) {
        return { isError: true, content: [{ type: "text", text: "Invalid path" }] };
    }
    try {
        let code = await fs.readFile(resolvePath(filePath), 'utf-8');
        if (filePath.endsWith('.js')) {
             code = await decodeDsSource(code);
        }
        const sandbox = {
            console: { log: () => {} }, // Mock console
            require: () => {}, // Disable require
        };
        vm.createContext(sandbox);
        // Execute code
        new vm.Script(code).runInContext(sandbox);
        
        if (!sandbox.rule) {
            return { isError: true, content: [{ type: "text", text: "Missing 'rule' object in spider file." }] };
        }
        
        // Basic validation of rule object
        const required = ['title', 'host', 'url'];
        const missing = required.filter(k => !sandbox.rule[k]);
        
        if (missing.length > 0) {
             return { isError: true, content: [{ type: "text", text: `Missing required fields in 'rule': ${missing.join(', ')}` }] };
        }
        
        return { content: [{ type: "text", text: "Spider structure is valid." }] };
    } catch (e) {
        return { isError: true, content: [{ type: "text", text: `Validation Error: ${e.message}` }] };
    }
};

export const check_syntax = async (args) => {
    const filePath = args?.path;
    if (!filePath || !isSafePath(filePath)) {
        return { isError: true, content: [{ type: "text", text: "Invalid path" }] };
    }
    try {
        let code = await fs.readFile(resolvePath(filePath), 'utf-8');
        if (filePath.endsWith('.js')) {
             code = await decodeDsSource(code);
        }
        new vm.Script(code);
        return { content: [{ type: "text", text: "Syntax OK" }] };
    } catch (e) {
        return { isError: true, content: [{ type: "text", text: `Syntax Error: ${e.message}\n${e.stack}` }] };
    }
};
