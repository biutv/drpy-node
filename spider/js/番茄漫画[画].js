/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '番茄漫画',
  '类型': '漫画',
  lang: 'ds'
})
*/

var rule = {
    类型: '漫画',
    title: '番茄漫画',
    host: 'https://qkfqapi.vv9v.cn',
    url: '',
    searchUrl: '/api/search?key=**&tab_type=8&offset=((fypage-1)*10)',
    detailUrl: '/api/detail?book_id=fyid',
    headers: {'User-Agent': 'UC_UA'},
    searchable: 1,
    quickSearch: 0,
    filterable: 0,
    double: true,
    play_parse: true,
    limit: 12,
    // class_parse: async function () {
    //     let {input, pdfa, pdfh, pd} = this;
    //     return {}
    // },
    lazy: async function () {
        let {input, pdfa, pdfh} = this;
        let title = input.split('@')[1];
        input = input.split('@')[0];
        let content_url = `https://qkfqapi.vv9v.cn/api/content?tab=漫画&item_id=${input}&show_html=0`; // 正文获取接口
        let jsonStr = await request(content_url);
        let images = jsonStr.parseX.data.images;
        images = pdfa(images, 'img');
        let pics = []
        for (let img of images) {
            let pic = pdfh(img, 'img&&src');
            pics.push(pic);
        }
        return {parse: 0, url: 'pics://' + pics.join('&&')}
    },
    推荐: async function () {
        return [{
            vod_id: 'only_search',
            vod_name: '纯搜索源哦！',
            vod_tag: 'action',
            vod_pic: this.publicUrl + '/images/icon_cookie/搜索.jpg'
        }];
    },
    一级: async function () {
        return [];
    },
    二级: async function () {
        let {input, orId} = this;
        // log('input', input);
        // log('orId', orId);
        let html = await request(input);
        let json = JSON.parse(html);
        let data = json.data.data;
        let VOD = {};
        VOD.vod_name = data.book_name;
        VOD.type_name = data.category;
        VOD.vod_pic = data.thumb_url;
        VOD.vod_content = data.abstract;
        VOD.vod_remarks = data.sub_info;
        VOD.vod_year = '';
        VOD.vod_area = '';
        VOD.vod_actor = '';
        VOD.vod_director = data.author;
        VOD.vod_play_from = '番茄漫画';
        let jsonStr = await request(`https://qkfqapi.vv9v.cn/api/book?book_id=${orId}`);
        let book_info = jsonStr.parseX.data.data;
        let list = book_info.chapterListWithVolume.flat();
        let urls = [];
        list.forEach((it, index) => {
            urls.push(it.title + '$' + it.itemId + '@' + it.title);
        });
        VOD.vod_play_url = urls.join('#');
        return VOD
    },
    搜索: async function () {
        let {input, MY_PAGE} = this;
        // if (Number(MY_PAGE) > 1) {
        //     return []
        // }
        print(input)
        let html = await request(input);
        let json = JSON.parse(html);
        let data = json.data.search_tabs[3].data;
        let d = [];
        for (let it of data.filter(i => i.book_data)) {
            let book = it.book_data[0];
            // console.log(book)
            d.push({
                title: book.book_name,
                url: book.book_id,
                desc: book.author,
                content: book.book_abstract || book.abstract,
                pic_url: book.thumb_url
            });
        }
        return setResult(d)
    },
    action: async function (action, value) {
        if (action === 'only_search') {
            return '此源为纯搜索源，你直接全局搜索这个源或者使用此页面的源内搜索就好了'
        }
    }
}