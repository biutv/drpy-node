/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '傻样[盘]',
  lang: 'ds'
})
*/


let {formatPlayUrl} = misc;
let aliTranscodingCache = {};
let aliDownloadingCache = {};

var rule = {
    title: '傻样[盘]',
    host: 'http://xsayang.fun:12512',
    url: '/index.php/vod/show/id/fyfilter.html',
    filter_url: '{{fl.cateId}}{{fl.area}}{{fl.by or "/by/time"}}{{fl.class}}{{fl.lang or "/lang/国语"}}{{fl.letter}}/page/fypage{{fl.year}}',
    searchUrl: '/index.php/vod/search/page/fypage/wd/**.html',
    filter: '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',
    filter_def: {
        1: {
            cateId: '1'
        },
        2: {
            cateId: '2'
        },
        3: {
            cateId: '3'
        },
        4: {
            cateId: '4'
        },
        5: {
            cateId: '5'
        },
        30: {
            cateId: '30'
        },
        35: {
            cateId: '35'
        },
        36: {
            cateId: '36'
        }
    },
    headers: {
        "User-Agent": "PC_UA",
        'Accept': 'text/html; charset=utf-8'
    },
    cate_exclude: '网址|专题|全部影片',
    tab_rename: {
        'KUAKE1': '夸克1',
        'KUAKE11': '夸克2',
        'YOUSEE1': 'UC1',
        'YOUSEE11': 'UC2',
    },
    //线路排序
    line_order: ['百度', '优汐', '夸克', '天翼', '123', '移动'],
    play_parse: true,
    search_match: true,
    searchable: 1,
    filterable: 1,
    timeout: 30000,
    quickSearch: 0,
    class_name: '傻样电影&傻样剧集&傻样天翼&傻样123&傻样115&傻样动漫&傻样综艺&傻样短剧',
    class_url: '1&2&3&4&5&30&35&36',
    class_parse: async () => {},
    预处理: async () => {
        // await Quark.initQuark()
        return []
    },
    
    推荐: async function() {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-items .module-item');
        data.forEach(it => {
            let title = pdfh(it, 'a&&title');
            d.push({
                title: title,
                img: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.module-item-text&&Text'),
                url: pd(it, 'a&&href')
            });
    });
    return setResult(d);
   },

    一级: async function() {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-items .module-item');
        data.forEach(it => {
            let title = pdfh(it, 'a&&title');
            d.push({
                title: title,
                img: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.module-item-text&&Text'),
                url: pd(it, 'a&&href')
            });
    });
    return setResult(d);
   },
        二级: async function(ids) {
    try {
        console.log("开始加载二级内容...");
        let loadStartTime = Date.now();
        
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input); 
        let data = pdfa(html, '.module-row-title');

        let vod = {
            vod_name: pdfh(html, '.video-info&&h1&&Text') || '',
            type_name: pdfh(html, '.tag-link&&Text') || '',
            vod_pic: pd(html, '.lazyload&&data-original||data-src||src') || '',
            vod_content: pdfh(html, '.sqjj_a--span&&Text') || '',
            vod_remarks: pdfh(html, '.video-info-items:eq(3)&&Text') || '',
            vod_year: pdfh(html, '.tag-link:eq(2)&&Text') || '',
            vod_area: pdfh(html, '.tag-link:eq(3)&&Text') || '',
            vod_actor: pdfh(html, '.video-info-actor:eq(1)&&Text') || '',
            vod_director: pdfh(html, '.video-info-actor:eq(0)&&Text') || ''
        };
        
        let playform = [];
        let playurls = [];
        let playPans = [];
        
        // 按网盘类型计数
        let panCounters = {
            '夸克': 1,
            '优汐': 1, 
            '百度': 1,
            '天翼': 1,
            '123': 1,
            '移动': 1
        };
        
        // 收集所有线路信息
        let allLines = [];
        
        for (let item of data) {
            let link = pd(item, 'p&&Text').trim();
            if (/pan.quark.cn/.test(link)) {
                playPans.push(link);
                let shareData = await Quark.getShareData(link);
                if (shareData) {
                    let videos = await Quark.getFilesByShareUrl(shareData);
                    if (videos.length > 0) {
                        let lineName = '夸克#' + panCounters.夸克;
                        let playUrl = videos.map((v) => {
                            let list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                            return v.file_name + '$' + list.join('*');
                        }).join('#');
                        allLines.push({name: lineName, url: playUrl, type: '夸克'});
                        panCounters.夸克++;
                    } else {
                        let lineName = '夸克#' + panCounters.夸克;
                        allLines.push({name: lineName, url: "资源已经失效，请访问其他资源", type: '夸克'});
                        panCounters.夸克++;
                    }
                }
            } else if (/drive.uc.cn/i.test(link)) {
                playPans.push(link);
                let shareData = await UC.getShareData(link);
                if (shareData) {
                    let videos = await UC.getFilesByShareUrl(shareData);
                    if (videos.length > 0) {
                        let lineName = '优汐#' + panCounters.优汐;  // 使用优汐计数
                        let playUrl = videos.map((v) => {
                            let list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                            return v.file_name + '$' + list.join('*');
                        }).join('#');
                        allLines.push({name: lineName, url: playUrl, type: '优汐'});  // 类型改为优汐
                        panCounters.优汐++;
                    } else {
                        let lineName = '优汐#' + panCounters.优汐;
                        allLines.push({name: lineName, url: "资源已经失效，请访问其他资源", type: '优汐'});
                        panCounters.优汐++;
                    }
                  }
                }else if (/cloud.189.cn/.test(link)) {
                playPans.push(link);
                let data = await Cloud.getShareData(link)
                Object.keys(data).forEach(it => {
                    let lineName = '天翼-' + it;
                    const urls = data[it].map(item => item.name + "$" + [item.fileId, item.shareId].join('*')).join('#');
                    allLines.push({name: lineName, url: urls, type: '天翼'});
                })
            }
            else if (/yun.139.com/.test(link)) {
                playPans.push(link);
                let data = await Yun.getShareData(link)
                Object.keys(data).forEach(it => {
                    let lineName = '移动-' + it;
                    const urls = data[it].map(item => item.name + "$" + [item.contentId, item.linkID].join('*')).join('#');
                    allLines.push({name: lineName, url: urls, type: '移动'});
                })
            }
           else if(/123/.test(link)) {
                playPans.push(link);
                let shareData = await Pan.getShareData(link)
                let videos = await Pan.getFilesByShareUrl(shareData)
                Object.keys(videos).forEach(it => {
                    let lineName = '123-' + it;
                    const urls = videos[it].map(v => {
                        const list = [v.ShareKey, v.FileId, v.S3KeyFlag, v.Size, v.Etag];
                        return v.FileName + '$' + list.join('*');
                    }).join('#');
                    allLines.push({name: lineName, url: urls, type: '123'});
                })
            }
            else if (/baidu/i.test(link)) {
                playPans.push(link);
                let shareData = await Baidu.getShareData(link);
                if (shareData) {
                    let files = await Baidu.getFilesByShareUrl(shareData);
                    if (files.videos && files.videos.length > 0) {
                        let lineName = `百度#${panCounters.百度}`;
                        let playUrl = files.videos.map(v =>
                            `${v.file_name}$${[shareData.shareId, v.fid, v.file_name].join('*')}`
                        ).join('#');
                        allLines.push({name: lineName, url: playUrl, type: '百度'});
                        panCounters.百度++;
                    } else {
                        let lineName = `百度#${panCounters.百度}`;
                        allLines.push({name: lineName, url: "资源已经失效，请访问其他资源", type: '百度'});
                        panCounters.百度++;
                    }
                }
            }
        }
        // 按照line_order排序
        allLines.sort((a, b) => {
            let aIndex = rule.line_order.indexOf(a.type);
            let bIndex = rule.line_order.indexOf(b.type);
            if (aIndex === -1) aIndex = Infinity;
            if (bIndex === -1) bIndex = Infinity;
            return aIndex - bIndex;
        });
        
        // 提取排序后的结果
        playform = allLines.map(line => line.name);
        playurls = allLines.map(line => line.url);
        
        vod.vod_play_from = playform.join("$$$");
        vod.vod_play_url = playurls.join("$$$");
        vod.vod_play_pan = playPans.join("$$$");
        
        let loadEndTime = Date.now();
        let loadTime = (loadEndTime - loadStartTime) / 1000;
        console.log(`二级内容加载完成，耗时: ${loadTime.toFixed(2)}秒`);
        
        return vod;
    } catch (error) {
        console.error(`❌ 二级函数执行出错: ${error.message}`);
        return {
            vod_name: '加载失败',
            type_name: '错误',
            vod_pic: '',
            vod_content: `加载失败: ${error.message}`,
            vod_remarks: '请检查网络或配置',
            vod_play_from: '加载错误$$$所有链接无效',
            vod_play_url: `错误信息: ${error.message}$$$请重试或检查配置`,
            vod_play_pan: ''
        };
    }
},

    搜索: async function() {
        let { input, pdfa, pdfh, pd,KEY } = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-items .module-search-item');
        data.forEach(it => {
            let title = pdfh(it, '.video-info&&a&&title');
            if (rule.search_match) {
            data = data.filter(it => {
                return title && new RegExp(KEY, "i").test(title);
            });
        }
            d.push({
                title: title,
                img: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.module-item-text&&Text'),
                url: pd(it, 'a&&href')
            });
    });
    return setResult(d);
   },
    lazy: async function(flag, id, flags) {
        let {input,mediaProxyUrl} = this;
        let ids = input.split('*');
        let urls = [];
        let UCDownloadingCache = {};
        let UCTranscodingCache = {};
        if (flag.startsWith('夸克')) {
            console.log("夸克网盘解析开始")
            let down = await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true);
            let headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'origin': 'https://pan.quark.cn',
                'referer': 'https://pan.quark.cn/',
                'Cookie': Quark.cookie
            };
            let transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
            transcoding.forEach((t) => {
                urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url)
            });
            return {
                parse: 0,
                url: urls,
                header: headers
            }
        } else if (flag.startsWith('UC')) {
            console.log("UC网盘解析开始");
            if (!UCDownloadingCache[ids[1]]) {
                let down = await UC.getDownload(ids[0], ids[1], ids[2], ids[3], true);
                if (down) UCDownloadingCache[ids[1]] = down;
            }
            let downCache = UCDownloadingCache[ids[1]];
            return await UC.getLazyResult(downCache, mediaProxyUrl)
        } else if (flag.startsWith('移动')) {
                console.log("移动网盘解析开始");
                let url = await Yun.getSharePlay(ids[0], ids[1]);
                return {
                    url: `${url}`
                };
            } else if (flag.startsWith('天翼')) {
                console.log("天翼网盘解析开始");
                let url = await Cloud.getShareUrl(ids[0], ids[1]);
                return {
                    url: `${url}`
                };
            } else if (flag.startsWith('123')) {
                console.log("123网盘解析开始");
                let url = await Pan.getDownload(ids[0], ids[1], ids[2], ids[3], ids[4]);
                 urls.push("原画", url);
                return {
                    parse: 0,
                    url: urls
                };
            } else if (flag.startsWith('百度')) {
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
    }
}