/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: '兄弟盘[搜]',
  lang: 'ds'
})
*/


var rule = {
    类型: '搜索',
    title: '兄弟盘[搜]',
    alias: '网盘搜索引擎',
    desc: '仅搜索源纯js写法',
    host: 'https://ysxjjkl.souyisou.top',
    url: '',
    searchUrl: '?search=**&limit=12&page=fypage',
    headers: {
        'User-Agent': 'PC_UA'
    },
    
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    double: true,
    play_parse: true,
    limit: 10,
    百度_img: 'https://pan.losfer.cn/view.php/15f16a3203e73ebfa1dab24687b78b96.png',

    action: async function(action, value) {
        if (action === 'only_search') {
            return '此源为纯搜索源，直接搜索即可，如输入 大奉打更人'
        }
        return `未定义动作:${action}`
    },

    推荐: async function() {
        return [{
            vod_id: 'only_search',
            vod_name: '这是个百度纯搜索源哦',
            vod_tag: 'action'
        }]
    },

    二级: async function(ids) {
        let {orId} = this;
        VOD = {};
        let link = orId || '';
        // 无效链接直接返回
        if (!link) {
            VOD.vod_play_from = '资源失效';
            VOD.vod_play_url = '资源失效$1';
            return VOD;
        }

        let playform = [];
        let playurls = [];
        // 处理百度网盘链接
        if (/baidu/i.test(link)) {
            try {
                let shareData = await Baidu.getShareData(link);
                let videos = await Baidu.getFilesByShareUrl(shareData);
                playform.push(`百度#1`);
                playurls.push(videos.videos.map(v =>
                    `${v.file_name}$${[shareData.shareId, v.fid, v.file_name].join('*')}`
                ).join('#'));
            } catch (error) {
                playform.push(`资源已经失效`);
                playurls.push("资源已经失效，请访问其他资源");
            }
        }
        VOD.vod_play_from = playform.join("$$$") || '暂无播放源';
        VOD.vod_play_url = playurls.join("$$$") || '暂无播放链接$暂无';
        VOD.vod_play_pan = link;

        return VOD;
    },

    搜索: async function(wd, pg) {
        let { input, pdfa, pdfh, pd, host } = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '#searchWrapper .box');
        data.forEach((it, index) => {
            let title = pdfh(it, '.info&&Text').trim().split('链接')[0];
            let link = pdfh(it, '.info a&&href');
            let code = pdfh(it, '.js-copy-code&&data-clipboard-text');
                d.push({
                    title: title,
                    img: rule.百度_img,
                    desc: '百度网盘',
                    content: '百度网盘',
                    url: link
                });
        });

        return setResult(d);
    },

    lazy: async function(flag, id, flags) {
        let {input} = this;
        let urls = [];
        let ids = input.split('*');
        if (flag.startsWith('百度')) {
            console.log("百度网盘解析开始");
            let down = await Baidu.getDownload(ids[0], ids[1], ids[2]);
            let headers = {
                'User-Agent': 'netdisk;1.4.2;22021211RC;android-android;12;JSbridge4.4.0;jointBridge;1.1.0;',
                'Referer': 'https://pan.baidu.com'
            };

            urls.push("原画", `${down.dlink}`);
            return {
                parse: 0,
                url: urls,
                header: headers
            };
        }
    },
}