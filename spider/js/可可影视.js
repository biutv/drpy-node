/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '可可影视',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    title: '可可影视',
    host: 'https://www.keke1.app/',
    url: '/show/fyclass-----2-fypage.html',
    filter_url: '',
    searchUrl: '/search?k=**穹&page=fypage',
    searchable: 0,
    quickSearch: 0,
    filterable: 0,
    filter: '',
    headers: {
        'User-Agent': MOBILE_UA,
    },
    timeout: 5000,
    class_name: '电影&连续剧&动漫&综艺&短剧',
    class_url: '1&2&3&4&6',
    play_parse: true,
    class_parse: async () => {
    },
    预处理: async () => {
    },
    图片替换: async function (input) {
        let {HOST} = this;
        // console.log('HOST:', HOST);
        return input.replace(HOST, "https://vres.cfaqcgj.com");
    },
    推荐: '.section-box:eq(2)&&.module-box-inner&&.module-item;*;*;*;*',
    double: false,
    一级: '.module-box-inner&&.module-item;.v-item-title:eq(1)&&Text;img:last-of-type&&data-original;.v-item-bottom&&span&&Text;a&&href',
    二级: {
        title: '.detail-pic&&img&&alt;.detail-tags&&a&&Text',
        img: '.detail-pic&&img&&data-original',
        desc: '.detail-info-row-main:eq(-2)&&Text;.detail-tags&&a&&Text;.detail-tags&&a:eq(1)&&Text;.detail-info-row-main:eq(1)&&Text;.detail-info-row-main&&Text',
        content: '.detail-desc&&Text',
        tabs: '.source-item-label',
        //tabs: 'body&&.source-item-label[id]',
        lists: '.episode-list:eq(#id) a',
    },
    搜索: '.search-result-list&&a;.title:eq(1)&&Text;*;.search-result-item-header&&Text;a&&href;.desc&&Text',
    lazy: $js.toString(async () => {
        log('input:', input);
        return {
            parse: 1,
            url: input,
            js: 'document.querySelector("#my-video video").click()',
        }
    }),
};