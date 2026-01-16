var rule = {
    类型: '小说',
    author: 'EylinSir',
    title: '阅读助手[书]',
    desc: '阅读助手小说源',
    host: 'https://api-bc.wtzw.com',
    homeUrl: 'https://api-bc.wtzw.com',
    url: '/api/v4/category/get-list?gender=fyclass&category_id=fyfilter&need_filters=1&page=fypage&need_category=1',
    class_name: '男生&女生&出版',
    class_url: '1&2&3',
    searchUrl: '/api/v5/search/words?gender=3&imei_ip=2937357107&page=fypage&wd=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    filter: {
        "1": [{key: "type", name: "类型", value: [{"n":"玄幻奇幻","v":"202"},{"n":"都市人生","v":"203"},{"n":"武侠仙侠","v":"205"},{"n":"历史军事","v":"56"},{"n":"科幻末世","v":"64"},{"n":"游戏竞技","v":"75"},{"n":"体育赛事","v":"206"},{"n":"奇闻异事","v":"204"}]}],
        "2": [{key: "type", name: "类型", value: [{"n":"现代言情","v":"1"},{"n":"古代言情","v":"2"},{"n":"幻想言情","v":"4"},{"n":"宫闱宅斗","v":"209"}]}],
        "3": [{key: "type", name: "类型", value: [{"n":"悬疑推理","v":"262"},{"n":"文学艺术","v":"240"},{"n":"历史传记","v":"264"}]}]
    },
    filter_url: "{{fl.type}}",
    filter_def: {},
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'},
    sign_headers: {
        "app-version": "51110", "platform": "android", "reg": "0", "AUTHORIZATION": "",
        "application-id": "com.****.reader", "net-env": "1", "channel": "unknown", "qm-params": ""
    },
    timeout: 10000,
    play_parse: true,

    request: async function (url, obj) {
        obj = obj || {};
        const response = await _fetch(url, {
            method: obj.method || 'GET',
            headers: obj.headers || this.headers
        });
        return response.text();
    },

    预处理: async function () {
        this.sign_headers.sign = getSignStr(this.sign_headers);
    },

    一级: async function (tid, pg, filter, extend) {
        let d = [];
        const cateMap = {'1':'202', '2':'1', '3':'262'};
        let gender = tid !== '-1' ? tid : '2';
        let category_id = cateMap[gender];
        const validSubTypes = ['202','203','205','56','64','75','206','204','1','2','4','209','262','240','264'];
        if (extend?.type && validSubTypes.includes(extend.type)) {
            category_id = extend.type;
        } else if (filter && validSubTypes.includes(filter)) {
            category_id = filter;
        }
        let params = {
            gender: gender,
            category_id: category_id,
            need_filters: '1',
            page: pg || '1',
            need_category: '1',
            imei_ip: '2937357107'
        };
        params.sign = getSignStr(params);
        let html = await this.request(buildUrl(`${this.host}/api/v4/category/get-list`, params), {headers: this.sign_headers});
        let json = JSON.parse(html);
        if (json?.data?.books) {
            d = json.data.books.map(it => ({
                title: it.title,
                url: `${this.host}/api/v4/book/detail?id=${it.id}`,
                desc: it.author,
                pic_url: it.image_link,
                content: it.intro
            }));
        }
        return setResult(d);
    },

    二级: async function () {
        let VOD = {};
        let bookId = this.input.match(/id=(\d+)/)[1];
        let detailParams = {id: bookId, imei_ip: '2937357107', teeny_mode: '0'};
        detailParams.sign = getSignStr(detailParams);
        let detailHtml = await this.request(buildUrl(`${this.host}/api/v4/book/detail`, detailParams), {headers: this.sign_headers});
        let detailJson = JSON.parse(detailHtml);
        if (detailJson?.data?.book) {
            let book = detailJson.data.book;
            VOD = {
                vod_name: book.title,
                type_name: book.book_tag_list?.map(tag => tag.title).join(',') || '',
                vod_pic: book.image_link,
                vod_content: book.intro,
                vod_remarks: book.latest_chapter_title,
                vod_year: '', vod_area: '',
                vod_actor: book.author, vod_director: book.author,
                vod_play_from: '阅读助手'
            };
            let tocParams = {id: book.id};
            tocParams.sign = getSignStr(tocParams);
            let tocHtml = await this.request(buildUrl('https://api-ks.wtzw.com/api/v1/chapter/chapter-list', tocParams), {headers: this.sign_headers});
            let tocJson = JSON.parse(tocHtml);
            if (tocJson?.data?.chapter_lists) {
                VOD.vod_play_url = tocJson.data.chapter_lists.map(chapter => 
                    `${chapter.title}$${book.id}@@${chapter.id}@@${chapter.title}`
                ).join('#');
            }
        }
        return VOD;
    },

    搜索: async function () {
        let d = [];
        let params = {
            gender: '3', imei_ip: '2937357107',
            page: this.MY_PAGE, wd: this.KEY
        };
        params.sign = getSignStr(params);
        let html = await this.request(buildUrl(`${this.host}/api/v5/search/words`, params), {headers: this.sign_headers});
        let json = JSON.parse(html);
        if (json?.data?.books) {
            d = json.data.books.map(it => ({
                title: it.original_title,
                desc: it.author,
                pic_url: it.image_link,
                url: `${this.host}/api/v4/book/detail?id=${it.id}`,
                content: it.intro
            }));
        }
        return setResult(d);
    },

    lazy: async function () {
        let [bookId, chapterId, title] = this.input.split('@@');
        let content = '内容加载失败';
        let params = {id: bookId, chapterId};
        params.sign = getSignStr(params);
        let html = await this.request(buildUrl('https://api-ks.wtzw.com/api/v1/chapter/content', params), {headers: this.sign_headers});
        let json = JSON.parse(html);
        if (json?.data?.content) content = decodeContent(json.data.content);
        return {
            parse: 0,
            url: `novel://${JSON.stringify({title, content})}`,
            js: ''
        };
    }
};

function getSignStr(params) {
    const sign_key = "d3dGiJc651gSQ8w1";
    return md5(Object.keys(params).sort().reduce((pre, n) => pre + n + "=" + params[n], "") + sign_key);
}

function decodeContent(content) {
    let key = CryptoJS.enc.Utf8.parse("242ccb8230d709e1");
    let ivEncData = CryptoJS.enc.Base64.parse(content);
    let iv = CryptoJS.lib.WordArray.create(ivEncData.words.slice(0, 4));
    let encrypted = CryptoJS.lib.WordArray.create(ivEncData.words.slice(4));
    let decrypted = CryptoJS.AES.decrypt({ciphertext: encrypted}, key, {
        iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}