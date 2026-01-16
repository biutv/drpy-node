/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: '去读书[书]',
  author: 'EylinSir',
  '类型': '小说',
  logo: 'http://www.qudushu.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '小说',
    author: 'EylinSir',
    title: '去读书[书]',
    host: 'http://www.qudushu.com',
    url: '/book/fyclass/0/fypage.html',
    logo: 'http://www.qudushu.com/favicon.ico',
    class_name: '玄幻魔法&武侠修真&都市言情&历史军事&穿越架空&游戏竞技',
    class_url: 'sort1&sort2&sort3&sort4&sort5&sort6',
    searchUrl: '/modules/article/search.php?q=**',
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    timeout: 10000,
    play_parse: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    },
    request: async function (url, obj) {
        obj = obj || {};
        try {
            const response = await _fetch(url, {
                method: obj.method || 'GET',
                headers: obj.headers || this.headers
            });
            return response.text();
        } catch (err) {
            return '';
        }
    },
    
    一级: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let url = input.startsWith('http') ? input : this.host + '/book/' + input + '/0/1.html';
        let html = await this.request(url);
        let d = [];
        let items = pdfa(html, '.blockcontent .c_row') || pdfa(html, '.c_row') || [];
        for (let item of items) {
            let title = pdfh(item, '.c_subject a:eq(1)&&Text');
            let itemUrl = pd(item, '.c_subject a:eq(1)&&href');
            if (!title || !itemUrl) continue;
            let remarks = pdfh(item, '.c_tag span:eq(1)&&Text') || '';
            let pic = pd(item, 'img&&src') || '';
            let content = pdfh(item, '.c_description&&Text') || '';
            d.push({
                title: title,
                url: itemUrl,
                desc: remarks,
                pic_url: pic,
                content: content,
            });
        }
        return setResult(d);
    },

    二级: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await this.request(input);
        let VOD = {};
        VOD.vod_name = pdfh(html, '[property="og:novel:book_name"]&&content') || '';
        VOD.type_name = '';
        VOD.vod_pic = pd(html, '.divbox.cf img&&src') || '';
        VOD.vod_content = pdfh(html, '.tabcontent .tabvalue:eq(0)&&Text') || '';
        VOD.vod_remarks = pdfh(html, 'h3 a&&Text') || '';
        VOD.vod_year = '';
        VOD.vod_area = '';
        VOD.vod_actor = pdfh(html, '[property="og:novel:author"]&&content') || '';
        VOD.vod_director = VOD.vod_actor;
        VOD.vod_play_from = '去读书网';
        let toc_url = pd(html, 'a:contains(点击阅读)&&href') || '';
        if (toc_url && !toc_url.startsWith('http')) {
            toc_url = this.host + toc_url;
        }
        let toc_html = toc_url ? await this.request(toc_url) : '';
        let chapters = [];
        let chapterItems = pdfa(toc_html, '.index li') || [];
        for (let chapter of chapterItems) {
            let title = pdfh(chapter, 'a&&Text');
            let chapter_url = pd(chapter, 'a&&href');
            if (!title || !chapter_url) continue;
            if (!chapter_url.startsWith('http')) {
                chapter_url = this.host + chapter_url;
            }
            chapters.push(title + '$' + chapter_url);
        }
        VOD.vod_play_url = chapters.join('#');
        return VOD;
    },

    搜索: async function () {
        let {KEY, pdfa, pdfh, pd} = this;
        let url = this.host + this.searchUrl.replace('**', encodeURIComponent(KEY));
        let html = await this.request(url);
        if (!html) {
            url = this.host + '/modules/article/search.php?q=' + encodeURIComponent(KEY);
            html = await this.request(url);
        }
        let d = [];
        let items = pdfa(html, '#jieqi_page_contents .c_row') || [];
        for (let item of items) {
            let title = pdfh(item, '.c_subject a&&Text');
            let itemUrl = pd(item, '.c_subject a&&href');
            if (!title || !itemUrl) continue;
            itemUrl = itemUrl.startsWith('http') ? itemUrl : this.host + itemUrl;
            let pic = pd(item, 'img&&src') || '';
            pic = pic.startsWith('http') ? pic : this.host + pic;
            d.push({
                title: title,
                url: itemUrl,
                desc: pdfh(item, '.c_tag span:eq(1)&&Text') || '',
                pic_url: pic,
                content: '',
            });
        }
        return setResult(d);
    },

    lazy: async function () {
        let {input, pdfh} = this;
        let html = await this.request(input);
        let title = pdfh(html, 'h1&&Text') || '';
        let content = pdfh(html, '#acontent&&Html') || '';
        if (content) {
            content = content.replace(/<script[^>]*?>.*?<\/script>/gs, '')
                             .replace(/<\/p>/g, '\n\n')
                             .replace(/<br[^>]*?>/g, '\n')
                             .replace(/<[^>]*?>/g, '')
                             .replace(/去读书推荐各位书友阅读：.*|去读书 www\.qudushu\.la|如果您中途有事离开，请按.*以便以后接着观看！/g, '')
                             .replace(/[()]/g, '')
                             .replace(/&nbsp;/g, ' ')
                             .replace(/[ \t]+/g, ' ')
                             .replace(/\n[ \t]+|[ \t]+\n/g, '\n')
                             .replace(/\n+/g, '\n\n')
                             .trim();
        }
        return {
            parse: 0,
            url: 'novel://' + JSON.stringify({title, content}),
            js: ''
        };
    }
};
