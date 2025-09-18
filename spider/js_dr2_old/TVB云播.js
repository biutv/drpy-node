/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    模板: '自动',
    host: 'http://www.tvyb03.com',
    url: '/vod/type/id/fyclass/page/fypage.html',
    searchUrl:'/vod/search/page/fypage/wd/**.html',
    搜索: '#searchList li;a&&title;.lazyload&&data-original;span.tag&&Text;a&&href;.detail&&Text',
    推荐: 'ul.myui-vodlist.clearfix;li;a&&title;a&&data-original;span.tag&&Text;a&&href',
    一级: '.myui-vodlist li;a&&title;a&&data-original;span.tag&&Text;a&&href',
        二级: {
        "title": "h1&&Text;.data:eq(0) a:eq(0)&&Text",
        "img": ".lazyload&&data-original",
        "desc": ";.data:eq(0) a:eq(2)&&Text;.data:eq(0) a:eq(1)&&Text;.data:eq(2)&&Text;.data:eq(3)&&Text",
        "content": ".text-collapse span&&Text",
        "tabs": ".myui-panel__head h3",
        "lists": ".myui-content__list:eq(#id) li"
    },
}