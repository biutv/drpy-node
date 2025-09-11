globalThis.MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
globalThis.PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36';
globalThis.UA = 'Mozilla/5.0';
globalThis.UC_UA = 'Mozilla/5.0 (Linux; U; Android 9; zh-CN; MI 9 Build/PKQ1.181121.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.5.5.1035 Mobile Safari/537.36';
globalThis.IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';

globalThis.RULE_CK = 'cookie'; // 源cookie的key值
globalThis.CATE_EXCLUDE = '首页|留言|APP|下载|资讯|新闻|动态';
globalThis.TAB_EXCLUDE = '猜你|喜欢|下载|剧情|榜|评论';
globalThis.OCR_RETRY = 3;//ocr验证重试次数
globalThis.OCR_API = 'https://api.nn.ci/ocr/b64/text';//ocr在线识别接口
globalThis.nodata = {
    list: [{
        vod_name: '无数据,防无限请求',
        vod_id: 'no_data',
        vod_remarks: '不要点,会崩的',
        vod_pic: 'https://ghproxy.net/https://raw.githubusercontent.com/hjdhnx/dr_py/main/404.jpg'
    }],
    total: 1, pagecount: 1, page: 1, limit: 1
};
globalThis.SPECIAL_URL = /^(ftp|magnet|thunder|ws):/;


globalThis.是否正版 = function (vipUrl) {
    let flag = new RegExp('qq\.com|iqiyi\.com|youku\.com|mgtv\.com|bilibili\.com|sohu\.com|ixigua\.com|pptv\.com|miguvideo\.com|le\.com|1905\.com|fun\.tv');
    return flag.test(vipUrl);
}

globalThis.urlDeal = function (vipUrl) {
    if (!vipUrl) {
        return ''
    }
    if (!是否正版(vipUrl)) {
        return vipUrl
    }
    if (!/miguvideo/.test(vipUrl)) {
        vipUrl = vipUrl.split('#')[0].split('?')[0];
    }
    return vipUrl
}

/**
 * 判断是否需要解析
 * @param url
 * @returns {number|number}
 */
function tellIsJx(url) {
    try {
        let is_vip = !/\.(m3u8|mp4|m4a)$/.test(url.split('?')[0]) && 是否正版(url);
        return is_vip ? 1 : 0
    } catch (e) {
        return 1
    }
}

globalThis.tellIsJx = tellIsJx;

globalThis.setResult = function (d) {
    if (!Array.isArray(d)) {
        return []
    }
    let vods = [];
    d.forEach(function (it) {
        let obj = {
            vod_id: it.url || '',
            vod_name: it.title || '',
            vod_remarks: it.desc || '',
            vod_content: it.content || '',
            vod_pic: it.pic_url || it.img || '',
        };
        let keys = Object.keys(it);
        if (keys.includes('tname')) {
            obj.type_name = it.tname || '';
        }
        if (keys.includes('tid')) {
            obj.type_id = it.tid || '';
        }
        if (keys.includes('year')) {
            obj.vod_year = it.year || '';
        }
        if (keys.includes('actor')) {
            obj.vod_actor = it.actor || '';
        }
        if (keys.includes('director')) {
            obj.vod_director = it.director || '';
        }
        if (keys.includes('area')) {
            obj.vod_area = it.area || '';
        }
        vods.push(obj);
    });
    return vods
}

globalThis.setResult2 = function (res) {
    return res.list || []
}

globalThis.setHomeResult = function (res) {
    if (!res || typeof (res) !== 'object') {
        return []
    }
    return setResult(res.list);
}

/**
 * 将base64编码进行url编译
 * @param str
 * @returns {string}
 */
globalThis.urlencode = function (str) {
    str = (str + '').toString();
    return encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');
}

/**
 * url编码,同 encodeURI
 * @param str
 * @returns {string}
 */
globalThis.encodeUrl = function (str) {
    if (typeof (encodeURI) == 'function') {
        return encodeURI(str)
    } else {
        str = (str + '').toString();
        return encodeURIComponent(str).replace(/%2F/g, '/').replace(/%3F/g, '?').replace(/%3A/g, ':').replace(/%40/g, '@').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%2B/g, '+').replace(/%24/g, '$');
    }
}

globalThis.uint8ArrayToBase64 = function (uint8Array) {
    let binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    return btoa(binaryString);
}

globalThis.Utf8ArrayToStr = function (array) {
    var out, i, len, c;
    var char2, char3;
    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
                break;
            case 14:
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(
                    ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
                );
                break;
        }
    }
    return out;
}

/**
 * gzip压缩base64|压缩率80%+
 * @param str
 * @returns {string}
 */
globalThis.gzip = function (str) {
    let arr = pako.gzip(str, {
        // to: 'string'
    });
    return uint8ArrayToBase64(arr)
}

/**
 * gzip解压base64数据
 * @param b64Data
 * @returns {string}
 */
globalThis.ungzip = function (b64Data) {
    let strData = atob(b64Data);
    const charData = strData.split('').map(function (x) {
        return x.charCodeAt(0);
    });
    const binData = new Uint8Array(charData);
    const data = pako.inflate(binData);
    return Utf8ArrayToStr(data);
}

/**
 * 字符串按指定编码
 * @param input
 * @param encoding
 * @returns {*}
 */
globalThis.encodeStr = function (input, encoding) {
    encoding = encoding || 'gbk';
    if (encoding.startsWith('gb')) {
        const strTool = gbkTool();
        input = strTool.encode(input);
    }
    return input
}

/**
 * 字符串指定解码
 * @param input
 * @param encoding
 * @returns {*}
 */
globalThis.decodeStr = function (input, encoding) {
    encoding = encoding || 'gbk';
    if (encoding.startsWith('gb')) {
        const strTool = gbkTool();
        input = strTool.decode(input);
    }
    return input
}

globalThis.getCryptoJS = function () {
    // return request('https://ghproxy.net/https://raw.githubusercontent.com/hjdhnx/dr_py/main/libs/crypto-hiker.js');
    return 'log("CryptoJS已装载");'
}

// 封装的RSA加解密类
globalThis.RSA = {
    decode: function (data, key, option) {
        option = option || {};
        if (typeof (JSEncrypt) === 'function') {
            let chunkSize = option.chunkSize || 117; // 默认分段长度为117
            let privateKey = this.getPrivateKey(key); // 获取私钥
            const decryptor = new JSEncrypt(); //创建解密对象实例
            decryptor.setPrivateKey(privateKey); //设置秘钥
            let uncrypted = '';
            // uncrypted = decryptor.decrypt(data);
            uncrypted = decryptor.decryptUnicodeLong(data);
            return uncrypted;
        } else {
            return false
        }
    },
    encode: function (data, key, option) {
        option = option || {};
        if (typeof (JSEncrypt) === 'function') {
            let chunkSize = option.chunkSize || 117; // 默认分段长度为117
            let publicKey = this.getPublicKey(key); // 获取公钥
            const encryptor = new JSEncrypt();
            encryptor.setPublicKey(publicKey); // 设置公钥
            let encrypted = ''; // 加密结果
            // const textLen = data.length; // 待加密文本长度
            // let offset = 0; // 分段偏移量
            // // 分段加密
            // while (offset < textLen) {
            //     let chunk = data.slice(offset, chunkSize); // 提取分段数据
            //     let enc = encryptor.encrypt(chunk); // 加密分段数据
            //     encrypted += enc; // 连接加密结果
            //     offset += chunkSize; // 更新偏移量
            // }
            encrypted = encryptor.encryptUnicodeLong(data);
            return encrypted
        } else {
            return false
        }
    },
    fixKey(key, prefix, endfix) {
        if (!key.includes(prefix)) {
            key = prefix + key;
        }
        if (!key.includes(endfix)) {
            key += endfix
        }
        return key
    },
    getPrivateKey(key) {
        let prefix = '-----BEGIN RSA PRIVATE KEY-----';
        let endfix = '-----END RSA PRIVATE KEY-----';
        return this.fixKey(key, prefix, endfix);
    },
    getPublicKey(key) {
        let prefix = '-----BEGIN PUBLIC KEY-----';
        let endfix = '-----END PUBLIC KEY-----';
        return this.fixKey(key, prefix, endfix);
    }
};

/**
 *  智能对比去除广告。支持嵌套m3u8。只需要传入播放地址
 * @param m3u8_url m3u8播放地址
 * @param headers 自定义访问m3u8的请求头,可以不传
 * @returns {string}
 */
globalThis.fixAdM3u8Ai = async function (m3u8_url, headers) {
    let ts = (new Date).getTime();
    let option = headers ? {
        headers: headers
    } : {};

    function b(s1, s2) {
        let i = 0;
        while (i < s1.length) {
            if (s1[i] !== s2[i]) {
                break
            }
            i++
        }
        return i
    }

    function reverseString(str) {
        return str.split("").reverse().join("")
    }

    let m3u8 = (await req(m3u8_url, option)).content;
    m3u8 = m3u8.trim().split("\n").map(it => it.startsWith("#") ? it : urljoin(m3u8_url, it)).join("\n");
    m3u8 = m3u8.replace(/\n\n/gi, "\n");
    let last_url = m3u8.split("\n").slice(-1)[0];
    if (last_url.length < 5) {
        last_url = m3u8.split("\n").slice(-2)[0]
    }
    if (last_url.includes(".m3u8") && last_url !== m3u8_url) {
        m3u8_url = urljoin(m3u8_url, last_url);
        log("[fixAdM3u8Ai]嵌套的m3u8_url:" + m3u8_url);
        m3u8 = (await req(m3u8_url, option)).content;
    }
    let s = m3u8.trim().split("\n").filter(it => it.trim()).join("\n");
    let ss = s.split("\n");
    let firststr = "";
    let maxl = 0;
    let kk = 0;
    let kkk1 = 1;
    let kkk2 = 0;
    let secondstr = "";
    for (let i = 0; i < ss.length; i++) {
        let s = ss[i];
        if (!s.startsWith("#")) {
            if (kk == 0)
                firststr = s;
            if (kk > 0) {
                if (maxl > b(firststr, s) + 1) {
                    if (secondstr.length < 5)
                        secondstr = s;
                    kkk2++
                } else {
                    maxl = b(firststr, s);
                    kkk1++
                }
            }
            kk++;
            if (kk >= 30)
                break
        }
    }
    if (kkk2 > kkk1)
        firststr = secondstr;
    let firststrlen = firststr.length;
    let ml = Math.round(ss.length / 2).toString().length;
    let maxc = 0;
    let laststr = ss.toReversed().find(x => {
            if (!x.startsWith("#")) {
                let k = b(reverseString(firststr), reverseString(x));
                maxl = b(firststr, x);
                maxc++;
                if (firststrlen - maxl <= ml + k || maxc > 10) {
                    return true
                }
            }
            return false
        }
    );
    log("[fixAdM3u8Ai]最后一条切片：" + laststr);
    let ad_urls = [];
    for (let i = 0; i < ss.length; i++) {
        let s = ss[i];
        if (!s.startsWith("#")) {
            if (b(firststr, s) < maxl) {
                ad_urls.push(s);
                ss.splice(i - 1, 2);
                i = i - 2
            } else {
                ss[i] = urljoin(m3u8_url, s)
            }
        } else {
            ss[i] = s.replace(/URI=\"(.*)\"/, 'URI="' + urljoin(m3u8_url, "$1") + '"')
        }
    }
    log("[fixAdM3u8Ai]处理的m3u8地址:" + m3u8_url);
    log("[fixAdM3u8Ai]----广告地址----");
    log("[fixAdM3u8Ai]广告地址列表:", ad_urls);
    m3u8 = ss.join("\n");
    log("[fixAdM3u8Ai]处理耗时：" + ((new Date).getTime() - ts).toString());
    log("[fixAdM3u8Ai]处理后的m3u8:", m3u8);
    return m3u8
}

/**
 * 强制正序算法
 * @param lists  待正序列表
 * @param key 正序键
 * @param option 单个元素处理函数
 * @returns {*}
 */
globalThis.forceOrder = function (lists, key, option) {
    let start = Math.floor(lists.length / 2);
    let end = Math.min(lists.length - 1, start + 1);
    if (start >= end) {
        return lists;
    }
    let first = lists[start];
    let second = lists[end];
    if (key) {
        try {
            first = first[key];
            second = second[key];
        } catch (e) {
        }
    }
    if (option && typeof (option) === 'function') {
        try {
            first = option(first);
            second = option(second);
        } catch (e) {
        }
    }
    first += '';
    second += '';
    // log(first,second);
    if (first.match(/(\d+)/) && second.match(/(\d+)/)) {
        let num1 = Number(first.match(/(\d+)/)[1]);
        let num2 = Number(second.match(/(\d+)/)[1]);
        if (num1 > num2) {
            lists.reverse();
        }
    }
    return lists
}

/**
 * 获取链接的query请求转为js的object字典对象
 * @param url
 * @returns {{}}
 */
globalThis.getQuery = function (url) {
    try {
        if (url.indexOf('?') > -1) {
            url = url.slice(url.indexOf('?') + 1);
        }
        let arr = url.split("#")[0].split("&");
        const resObj = {};
        arr.forEach(item => {
            let arr1 = item.split("=");
            let key = arr1[0];
            let value = arr1.slice(1).join('=');
            resObj[key] = value;
        });
        return resObj;
    } catch (err) {
        log(`[getQuery]getQuery发生错误:${e.message}`)
        return {};
    }
}

const defaultParser = {
    pdfh: pdfh,
    pdfa: pdfa,
    pd: pd,
};

const parseTags = {
    jsp: {
        pdfh: pdfh,
        pdfa: pdfa,
        pd: pd,
    },
    json: {
        pdfh(html, parse) {
            if (!parse || !parse.trim()) {
                return '';
            }
            if (typeof (html) === 'string') {
                // print('jsonpath:pdfh字符串转dict');
                html = JSON.parse(html);
            }
            parse = parse.trim();
            if (!parse.startsWith('$.')) {
                parse = '$.' + parse;
            }
            parse = parse.split('||');
            for (let ps of parse) {
                let ret = cheerio.jp(ps, html);
                if (Array.isArray(ret)) {
                    ret = ret[0] || '';
                } else {
                    ret = ret || ''
                }
                if (ret && typeof (ret) !== 'string') {
                    ret = ret.toString();
                }
                if (ret) {
                    return ret
                }
            }
            return '';
        },
        pdfa(html, parse) {
            if (!parse || !parse.trim()) {
                return '';
            }
            if (typeof (html) === 'string') {
                // print('jsonpath:pdfa字符串转dict');
                html = JSON.parse(html);
            }
            parse = parse.trim()
            if (!parse.startsWith('$.')) {
                parse = '$.' + parse;
            }
            let ret = cheerio.jp(parse, html);
            if (Array.isArray(ret) && Array.isArray(ret[0]) && ret.length === 1) {
                return ret[0] || []
            }
            return ret || []
        },
        pd(html, parse) {
            let ret = parseTags.json.pdfh(html, parse);
            if (ret) {
                return urljoin(MY_URL, ret);
            }
            return ret
        },
    },
    jq: {
        pdfh(html, parse) {
            if (!html || !parse || !parse.trim()) {
                return ''
            }
            parse = parse.trim();
            let result = defaultParser.pdfh(html, parse);
            // print(`pdfh解析${parse}=>${result}`);
            return result;
        },
        pdfa(html, parse) {
            if (!html || !parse || !parse.trim()) {
                return [];
            }
            parse = parse.trim();
            let result = defaultParser.pdfa(html, parse);
            // print(result);
            print(`pdfa解析${parse}=>${result.length}`);
            return result;
        },
        pd(html, parse, base_url) {
            if (!html || !parse || !parse.trim()) {
                return ''
            }
            parse = parse.trim();
            base_url = base_url || MY_URL;
            return defaultParser.pd(html, parse, base_url);
        },
    },
    getParse(p0) {//非js开头的情况自动获取解析标签
        if (p0.startsWith('jsp:')) {
            return this.jsp
        } else if (p0.startsWith('json:')) {
            return this.json
        } else if (p0.startsWith('jq:')) {
            return this.jq
        } else {
            return this.jq
        }
    }
};

globalThis.stringify = JSON.stringify;
// const jsp = parseTags.jsp;
// const jq = parseTags.jq;

/**
 * 处理返回的json数据
 * @param html
 * @returns {*}
 */
globalThis.dealJson = function (html) {
    try {
        // html = html.match(/[\w|\W|\s|\S]*?(\{[\w|\W|\s|\S]*\})/).group[1];
        html = html.trim();
        if (!((html.startsWith('{') && html.endsWith('}')) || (html.startsWith('[') && html.endsWith(']')))) {
            html = '{' + html.match(/.*?\{(.*)\}/m)[1] + '}';
        }
    } catch (e) {
    }
    try {
        html = JSON.parse(html);
    } catch (e) {
    }
    // log(typeof(html));
    return html;
}


/**
 * 验证码识别逻辑,需要java实现(js没有bytes类型,无法调用后端的传递图片二进制获取验证码文本的接口)
 * @type {{api: string, classification: (function(*=): string)}}
 */
globalThis.OcrApi = {
    api: OCR_API,
    classification: async function (img) { // img是byte类型,这里不方便搞啊
        let code = '';
        try {
            // let html = request(this.api,{data:{img:img},headers:{'User-Agent':PC_UA},'method':'POST'},true);
            // html = JSON.parse(html);
            // code = html.url||'';
            log('[OcrApi.classification]通过drpy_ocr验证码接口过验证...');
            let html = '';
            if (this.api.endsWith('drpy/text')) {
                html = (await req(this.api, {
                    data: {img: img},
                    headers: {'User-Agent': PC_UA},
                    'method': 'POST'
                })).content;
            } else {
                html = (await req(this.api, {body: img, headers: {'User-Agent': PC_UA}, 'method': 'POST'})).content;
            }
            code = html || '';
        } catch (e) {
            log(`[OcrApi.classification]OCR识别验证码发生错误:${e.message}`)
        }
        return code
    }
};

/**
 * 获取链接的host(带http协议的完整链接)
 * @param url 任意一个正常完整的Url,自动提取根
 * @returns {string}
 */
globalThis.getHome = function (url) {
    if (!url) {
        return ''
    }
    let tmp = url.split('//');
    url = tmp[0] + '//' + tmp[1].split('/')[0];
    try {
        url = decodeURIComponent(url);
    } catch (e) {
    }
    return url
}

/**
 * get参数编译链接,类似python params字典自动拼接
 * @param url 访问链接
 * @param obj 参数字典
 * @returns {*}
 */
globalThis.buildUrl = function (url, obj) {
    obj = obj || {};
    if (url.indexOf('?') < 0) {
        url += '?'
    }
    let param_list = [];
    let keys = Object.keys(obj);
    keys.forEach(it => {
        param_list.push(it + '=' + obj[it])
    });
    let prs = param_list.join('&');
    if (keys.length > 0 && !url.endsWith('?')) {
        url += '&'
    }
    url += prs;
    return url
}

/**
 * 远程依赖执行函数
 * @param url 远程js地址
 */
function $require(url) {
    eval(request(url));
}

//对象To字符串query
globalThis.buildQueryString = function (params) {
    const queryArray = [];
    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            // 处理参数值：兼容null、undefined，转为字符串并编码
            let value = params[key];
            if (value === undefined || value === null) {
                value = "";
            } else {
                value = value.toString();
            }
            // 编码键值（兼容ES5）
            const encodedKey = encodeURIComponent(key);
            const encodedValue = encodeURIComponent(value);
            queryArray.push(encodedKey + "=" + encodedValue);
        }
    }
    return queryArray.join("&");
}

//字符串To对象
globalThis.parseQueryString = function (query) {
    const params = {};
    query.split('&').forEach(function (part) {
        // 使用正则表达式匹配键和值，直到遇到第一个等号为止
        const regex = /^(.*?)=(.*)/;
        const match = part.match(regex);
        if (match) {
            const key = decodeURIComponent(match[1]);
            const value = decodeURIComponent(match[2]);
            params[key] = value;
        }
    });
    return params;
}

//URL需要转码字符串
globalThis.encodeIfContainsSpecialChars = function (value) {
    // 定义在URL中需要编码的特殊字符
    const specialChars = ":/?#[]@!$'()*+,;=%";
    // 检查值中是否包含特殊字符
    if (specialChars.split('').some(char => value.toString().includes(char))) {
        // 如果包含，则使用encodeURIComponent进行编码
        return encodeURIComponent(value);
    }
    // 如果不包含特殊字符，返回原值
    return value;
}

//对象To字符串
globalThis.objectToQueryString = function (obj) {
    const encoded = [];
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            encoded.push(encodeURIComponent(key) + '=' + encodeIfContainsSpecialChars(obj[key]));
        }
    }
    return encoded.join('&');
}
globalThis.parseTags = parseTags;