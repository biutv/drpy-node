/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '风车动漫',
  lang: 'cat'
})
*/
import {urljoin, parseList, parseDetail, lazy, request, cheerio, CryptoJS} from "./_dsutil.js";

const host = 'https://www.dmla5.com';

function init(cfg) {
    const ext = cfg.ext;
}

async function home(filter) {
    let html = await request(host);
    const $ = cheerio.load(html);
    const listItems = $('.stui-header__menu li:gt(0):lt(4)');
    let classes = [];
    listItems.each((index, element) => {
        const item = $(element);
        // 提取数据
        const type_name = item.find('a').text().trim();
        const type_id = urljoin(host, item.find('a').attr('href')).match(/.*\/(.*?)\.html/)[1];

        classes.push({
            type_name,
            type_id,
        });
    });
    let res = {
        'class': classes
    };
    return JSON.stringify(res);
}

async function homeVod(params) {
    let html = await request(host);
    const $ = cheerio.load(html);
    const listItems = $('ul.stui-vodlist.clearfix li');
    const d = parseList($, host, listItems);

    return JSON.stringify({
        list: d
    });
}

async function category(tid, pg, filter, extend) {
    let url = `${host}/type/${tid}-${pg}.html`;
    let html = await request(url);
    const $ = cheerio.load(html);
    const listItems = $('.stui-vodlist li');
    const d = parseList($, host, listItems);

    return JSON.stringify({
        list: d
    });
}

async function detail(id) {
    let url = urljoin(host, id);
    let html = await request(url);
    const $ = cheerio.load(html);

    const vod = parseDetail($, host, url);
    return JSON.stringify({
        list: [vod]
    })
}

async function play(flag, id, flags) {
    console.log("play");
    return await lazy(urljoin(host, id));
}

async function search(wd, quick, pg) {
    let url = `${host}/search/${wd}----------${pg}---.html`;
    let html = await request(url);
    const $ = cheerio.load(html);
    const listItems = $('ul.stui-vodlist__media li');
    const d = parseList($, host, listItems);

    return JSON.stringify({
        list: d
    });
}

function proxy(params) {
    return [200, 'text/plain;charset=utf-8', 'ok', null];
}

// 导出函数对象
export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search,
    proxy: proxy,
}