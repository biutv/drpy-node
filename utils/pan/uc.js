import req from '../req.js';
import {ENV} from '../env.js';
import COOKIE from '../cookieManager.js';
import CryptoJS from "crypto-js";
import {join} from 'path';
import fs from 'fs';
import {PassThrough} from 'stream';

class UCHandler {
    constructor() {
        this.regex = /https:\/\/drive\.uc\.cn\/s\/([^\\|#/]+)/;
        this.pr = 'pr=UCBrowser&fr=pc';
        this.baseHeader = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) uc-cloud-drive/1.8.5 Chrome/100.0.4896.160 Electron/18.3.5.16-b62cf9c50d Safari/537.36 Channel/ucpan_other_ch',
            Referer: 'https://drive.uc.cn/',
        };
        this.apiUrl = 'https://pc-api.uc.cn/1/clouddrive';
        this.shareTokenCache = {};
        this.saveDirName = 'drpy';
        this.saveDirId = null;
        this.saveFileIdCaches = {};
        this.currentUrlKey = '';
        this.cacheRoot = (process.env['NODE_PATH'] || '.') + '/uc_cache';
        this.maxCache = 1024 * 1024 * 100;
        this.urlHeadCache = {};
        this.subtitleExts = ['.srt', '.ass', '.scc', '.stl', '.ttml'];
        this.Addition = {
            DeviceID: '07b48aaba8a739356ab8107b5e230ad4',
            RefreshToken: '',
            AccessToken: ''
        }
        this.conf = {
            api: "https://open-api-drive.uc.cn",
            clientID: "5acf882d27b74502b7040b0c65519aa7",
            signKey: "l3srvtd7p42l0d0x1u8d7yc8ye9kki4d",
            appVer: "1.6.8",
            channel: "UCTVOFFICIALWEB",
            codeApi: "http://api.extscreen.com/ucdrive",
        };

    }

    // 使用 getter 定义动态属性
    get cookie() {
        // console.log('env.cookie.uc:',ENV.get('uc_cookie'));
        return ENV.get('uc_cookie');
    }

    get token() {
        return ENV.get('uc_token_cookie');
    }

    getShareData(url) {
        let matches = this.regex.exec(url);
        if (matches[1].indexOf("?") > 0) {
            matches[1] = matches[1].split('?')[0];
        }
        if (matches) {
            return {
                shareId: matches[1],
                folderId: '0',
            };
        }
        return null;
    }

    async initUC(db, cfg) {
        if (this.cookie) {
            console.log("cookie 获取成功");
        } else {
            console.log("cookie 获取失败")
        }
    }

    lcs(str1, str2) {
        if (!str1 || !str2) {
            return {
                length: 0,
                sequence: '',
                offset: 0,
            };
        }
        var sequence = '';
        var str1Length = str1.length;
        var str2Length = str2.length;
        var num = new Array(str1Length);
        var maxlen = 0;
        var lastSubsBegin = 0;
        for (var i = 0; i < str1Length; i++) {
            var subArray = new Array(str2Length);
            for (var j = 0; j < str2Length; j++) {
                subArray[j] = 0;
            }
            num[i] = subArray;

        }
        var thisSubsBegin = null;
        for (i = 0; i < str1Length; i++) {
            for (j = 0; j < str2Length; j++) {
                if (str1[i] !== str2[j]) {
                    num[i][j] = 0;
                } else {
                    if (i === 0 || j === 0) {
                        num[i][j] = 1;
                    } else {
                        num[i][j] = 1 + num[i - 1][j - 1];
                    }

                    if (num[i][j] > maxlen) {
                        maxlen = num[i][j];
                        thisSubsBegin = i - num[i][j] + 1;
                        if (lastSubsBegin === thisSubsBegin) {
                            sequence += str1[i];
                        } else {
                            lastSubsBegin = thisSubsBegin;

                            sequence = ''; // clear it

                            sequence += str1.substr(lastSubsBegin, i + 1 - lastSubsBegin);

                        }

                    }

                }

            }

        }
        return {
            length: maxlen,
            sequence: sequence,
            offset: thisSubsBegin,
        };
    }


    findBestLCS(mainItem, targetItems) {

        const results = [];

        let bestMatchIndex = 0;


        for (let i = 0; i < targetItems.length; i++) {

            const currentLCS = this.lcs(mainItem.name, targetItems[i].name);

            results.push({target: targetItems[i], lcs: currentLCS});

            if (currentLCS.length > results[bestMatchIndex].lcs.length) {

                bestMatchIndex = i;

            }

        }


        const bestMatch = results[bestMatchIndex];


        return {allLCS: results, bestMatch: bestMatch, bestMatchIndex: bestMatchIndex};

    }


    delay(ms) {

        return new Promise((resolve) => setTimeout(resolve, ms));

    }


    async api(url, data, headers, method, retry) {
        headers = headers || {};
        Object.assign(headers, this.baseHeader);
        Object.assign(headers, {
            'Content-Type': 'application/json',
            Cookie: this.cookie || '',
        });
        method = method || 'post';
        const resp =
            method === 'get' ? await req.get(`${this.apiUrl}/${url}`, {
                headers: headers,
            }).catch((err) => {
                console.error(err);
                return err.response || {status: 500, data: {}};
            }) : await req.post(`${this.apiUrl}/${url}`, data, {
                headers: headers,
            }).catch((err) => {
                console.error(err);
                return err.response || {status: 500, data: {}};
            });
        const leftRetry = retry || 3;
        if (resp.status === 429 && leftRetry > 0) {
            await this.delay(1000);
            return await this.api(url, data, headers, method, leftRetry - 1);
        }
        return resp.data || {};
    }


    async clearSaveDir() {
        const listData = await this.api(`file/sort?${this.pr}&pdir_fid=${this.saveDirId}&_page=1&_size=200&_sort=file_type:asc,updated_at:desc`, {}, {}, 'get');
        if (listData.data && listData.data.list && listData.data.list.length > 0) {
            const del = await this.api(`file/delete?${this.pr}`, {
                action_type: 2,
                filelist: listData.data.list.map((v) => v.fid),
                exclude_fids: [],
            });
            console.log(del);
        }
    }

    async createSaveDir(clean) {
        if (this.saveDirId) {
            if (clean) await this.clearSaveDir();
            return;

        }
        const listData = await this.api(`file/sort?${this.pr}&pdir_fid=0&_page=1&_size=200&_sort=file_type:asc,updated_at:desc`, {}, {}, 'get');
        if (listData.data && listData.data.list)
            for (const item of listData.data.list) {
                if (item.file_name === this.saveDirName) {
                    this.saveDirId = item.fid;
                    await this.clearSaveDir();
                    break;
                }

            }

        if (!this.saveDirId) {
            const create = await this.api(`file?${this.pr}`, {
                pdir_fid: '0',
                file_name: this.saveDirName,
                dir_path: '',
                dir_init_lock: false,
            });
            console.log(create);
            if (create.data && create.data.fid) {
                this.saveDirId = create.data.fid;
            }
        }
    }

    async getShareToken(shareData) {
        if (!this.shareTokenCache[shareData.shareId]) {
            delete this.shareTokenCache[shareData.shareId];
            const shareToken = await this.api(`share/sharepage/token?${this.pr}`, {
                pwd_id: shareData.shareId,
                passcode: shareData.sharePwd || '',
            });
            if (shareToken.data && shareToken.data.stoken) {
                this.shareTokenCache[shareData.shareId] = shareToken.data;
            }

        }

    }

    async getFilesByShareUrl(shareInfo) {
        const shareData = typeof shareInfo === 'string' ? this.getShareData(shareInfo) : shareInfo;
        if (!shareData) return [];
        await this.getShareToken(shareData);
        if (!this.shareTokenCache[shareData.shareId]) return [];
        const videos = [];
        const subtitles = [];
        const listFile = async (shareId, folderId, page) => {
            const prePage = 200;
            page = page || 1;
            const listData = await this.api(`share/sharepage/detail?${this.pr}&pwd_id=${shareId}&stoken=${encodeURIComponent(this.shareTokenCache[shareId].stoken)}&pdir_fid=${folderId}&force=0&_page=${page}&_size=${prePage}&_sort=file_type:asc,file_name:asc`, {}, {}, 'get');
            if (!listData.data) return [];
            const items = listData.data.list;
            if (!items) return [];
            const subDir = [];
            for (const item of items) {
                if (item.dir === true) {
                    subDir.push(item);
                } else if (item.file === true && item.obj_category === 'video') {
                    if (item.size < 1024 * 1024 * 5) continue;
                    item.stoken = this.shareTokenCache[shareData.shareId].stoken;
                    videos.push(item);
                } else if (item.type === 'file' && this.subtitleExts.some((x) => item.file_name.endsWith(x))) {
                    subtitles.push(item);
                }
            }
            if (page < Math.ceil(listData.metadata._total / prePage)) {
                const nextItems = await listFile(shareId, folderId, page + 1);
                for (const item of nextItems) {
                    items.push(item);
                }
            }
            for (const dir of subDir) {
                const subItems = await listFile(shareId, dir.fid);
                for (const item of subItems) {
                    items.push(item);
                }
            }
            return items;
        };
        await listFile(shareData.shareId, shareData.folderId);
        if (subtitles.length > 0) {
            videos.forEach((item) => {
                var matchSubtitle = this.findBestLCS(item, subtitles);
                if (matchSubtitle.bestMatch) {
                    item.subtitle = matchSubtitle.bestMatch.target;
                }
            });
        }
        return videos;
    }

    async save(shareId, stoken, fileId, fileToken, clean) {
        await this.createSaveDir(clean);
        if (clean) {
            const saves = Object.keys(this.saveFileIdCaches);
            for (const save of saves) {
                delete this.saveFileIdCaches[save];
            }
        }
        if (!this.saveDirId) return null;
        if (!stoken) {
            await this.getShareToken({
                shareId: shareId,
            });
            if (!this.shareTokenCache[shareId]) return null;
        }

        const saveResult = await this.api(`share/sharepage/save?${this.pr}`, {
            fid_list: [fileId],
            fid_token_list: [fileToken],
            to_pdir_fid: this.saveDirId,
            pwd_id: shareId,
            stoken: stoken || this.shareTokenCache[shareId].stoken,
            pdir_fid: '0',
            scene: 'link',
        });
        if (saveResult.data && saveResult.data.task_id) {
            let retry = 0;
            while (true) {
                const taskResult = await this.api(`task?${this.pr}&task_id=${saveResult.data.task_id}&retry_index=${retry}`, {}, {}, 'get');
                if (taskResult.data && taskResult.data.save_as && taskResult.data.save_as.save_as_top_fids && taskResult.data.save_as.save_as_top_fids.length > 0) {
                    return taskResult.data.save_as.save_as_top_fids[0];

                }
                retry++;
                if (retry > 5) break;
                await this.delay(1000);
            }
        }
        return true;
    }

    async getLiveTranscoding(shareId, stoken, fileId, fileToken) {
        if (!this.saveFileIdCaches[fileId]) {
            const saveFileId = await this.save(shareId, stoken, fileId, fileToken, true);
            if (!saveFileId) return null;

            this.saveFileIdCaches[fileId] = saveFileId;
        }
        const transcoding = await this.api(`file/v2/play?${this.pr}`, {
            fid: this.saveFileIdCaches[fileId],
            resolutions: 'normal,low,high,super,2k,4k',
            supports: 'fmp4',

        });
        if (transcoding.data && transcoding.data.video_list) {
            return transcoding.data.video_list;
        }
        return null;

    }

    async refreshUcCookie(from = '') {
        const nowCookie = this.cookie;
        const cookieSelfRes = await axios({
            url: "https://pc-api.uc.cn/1/clouddrive/config?pr=UCBrowser&fr=pc",
            method: "GET",
            headers: {
                "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch',
                Origin: 'https://drive.uc.cn',
                Referer: 'https://drive.uc.cn/',
                Cookie: nowCookie
            }
        });
        const cookieResDataSelf = cookieSelfRes.headers;
        const resCookie = cookieResDataSelf['set-cookie'];
        if (!resCookie) {
            console.log(`${from}自动更新UC cookie: 没返回新的cookie`);
            return
        }
        const cookieObject = COOKIE.parse(resCookie);
        // console.log(cookieObject);
        if (cookieObject.__puus) {
            const oldCookie = COOKIE.parse(nowCookie);
            const newCookie = COOKIE.stringify({
                __pus: oldCookie.__pus,
                __puus: cookieObject.__puus,
            });
            console.log(`${from}自动更新UC cookie: ${newCookie}`);
            ENV.set('uc_cookie', newCookie);
        }
    }

    generateDeviceID(timestamp) {
        return CryptoJS.MD5(timestamp).toString().slice(0, 16); // 取前16位
    }

    generateReqId(deviceID, timestamp) {
        return CryptoJS.MD5(deviceID + timestamp).toString().slice(0, 16);
    }

    generateXPanToken(method, pathname, timestamp, key) {
        const data = method + '&' + pathname + '&' + timestamp + '&' + key;
        return CryptoJS.SHA256(data).toString();
    }


    async getDownload(shareId, stoken, fileId, fileToken, clean) {

        if (!this.saveFileIdCaches[fileId]) {

            const saveFileId = await this.save(shareId, stoken, fileId, fileToken, clean);

            if (!saveFileId) return null;

            this.saveFileIdCaches[fileId] = saveFileId;

        }
        if (this.token) {
            let video = []
            const pathname = '/file';
            const timestamp = Math.floor(Date.now() / 1000).toString() + '000'; // 13位时间戳需调整
            const deviceID = this.Addition.DeviceID || this.generateDeviceID(timestamp);
            const reqId = this.generateReqId(deviceID, timestamp);
            const x_pan_token = this.generateXPanToken("GET", pathname, timestamp, this.conf.signKey);
            let config = {
                method: 'GET',
                url: `https://open-api-drive.uc.cn/file`,
                params: {
                    req_id: reqId,
                    access_token: this.token,
                    app_ver: this.conf.appVer,
                    device_id: deviceID,
                    device_brand: 'Xiaomi',
                    platform: 'tv',
                    device_name: 'M2004J7AC',
                    device_model: 'M2004J7AC',
                    build_device: 'M2004J7AC',
                    build_product: 'M2004J7AC',
                    device_gpu: 'Adreno (TM) 550',
                    activity_rect: '{}',
                    channel: this.conf.channel,
                    method: "streaming",
                    group_by: "source",
                    fid: this.saveFileIdCaches[fileId],
                    resolution: "low,normal,high,super,2k,4k",
                    support: "dolby_vision"
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; U; Android 9; zh-cn; RMX1931 Build/PQ3A.190605.05081124) AppleWebKit/533.1 (KHTML, like Gecko) Mobile Safari/533.1',
                    'Connection': 'Keep-Alive',
                    'Accept-Encoding': 'gzip',
                    'x-pan-tm': timestamp,
                    'x-pan-token': x_pan_token,
                    'content-type': 'text/plain;charset=UTF-8',
                    'x-pan-client-id': this.conf.clientID
                }
            }
            let req = await axios.request(config).catch((err) => err.response);
            if (req.status === 200) {
                let videoInfo = req.data.data.video_info
                videoInfo.forEach((item) => {
                    video.push({
                        name: item.resolution,
                        url: item.url
                    })
                })
                return video;
            }
            if (req.data.status === -1 || req.data.errno === 10001) {
                let data = JSON.stringify({
                    "req_id": reqId,
                    "app_ver": this.conf.appVer,
                    "device_id": deviceID,
                    "device_brand": "OPPO",
                    "platform": "tv",
                    "device_name": "PCRT00",
                    "device_model": "PCRT00",
                    "build_device": "aosp",
                    "build_product": "PCRT00",
                    "device_gpu": "Adreno%20(TM)%20640",
                    "activity_rect": "%7B%7D",
                    "channel": this.conf.channel,
                    "refresh_token": this.token
                });
                let config = {
                    method: 'POST',
                    url: 'http://api.extscreen.com/ucdrive/token',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 7.1.2; zh-cn; PCRT00 Build/N2G47O) AppleWebKit/533.1 (KHTML, like Gecko) Mobile Safari/533.1',
                        'Connection': 'Keep-Alive',
                        'Accept-Encoding': 'gzip',
                        'Content-Type': 'application/json',
                        'Cookie': 'sl-session=VIaxTAKF8mdJBhU2uda0zA=='
                    },
                    data: data
                };
                let req = await axios.request(config);
                if (req.status === 200) {
                    ENV.set('uc_token_cookie', req.data.data.refresh_token)
                    return await this.getDownload(shareId, stoken, fileId, fileToken, clean)
                }
            }
        } else {
            const down = await this.api(`file/download?${this.pr}`, {
                fids: [this.saveFileIdCaches[fileId]],
            });
            if (down.data) {
                const low_url = down.data[0].download_url;
                const low_cookie = this.cookie;
                const low_headers = {
                    "Referer": "https://drive.uc.cn/",
                    "cookie": low_cookie,
                    "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch'
                };
                // console.log('low_url:', low_url);
                const test_result = await this.testSupport(low_url, low_headers);
                // console.log('test_result:', test_result);
                if (!test_result[0]) {
                    try {
                        await this.refreshUcCookie('getDownload');
                    } catch (e) {
                        console.log(`getDownload:自动刷新UC cookie失败:${e.message}`)
                    }
                }
                return down.data[0];
            }
        }
        return null;
    }

    async getLazyResult(downCache, mediaProxyUrl) {
        const urls = [];
        if (Array.isArray(downCache)) {
            downCache.forEach((it) => {
                urls.push(it.name, it.url);
            });
        }
        return {parse: 0, url: urls}

        /*
        // 旧的加速写法
        const downUrl = downCache.download_url;
        const headers = {
            "Referer": "https://drive.uc.cn/",
            "cookie": this.cookie,
            "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch'
        };
        urls.push("UC原画", downUrl);
        urls.push("原代服", mediaProxyUrl + `?thread=${ENV.get('thread') || 6}&form=urlcode&randUa=1&url=` + encodeURIComponent(downUrl) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
        if (ENV.get('play_local_proxy_type', '1') === '2') {
            urls.push("原代本", `http://127.0.0.1:7777/?thread=${ENV.get('thread') || 6}&form=urlcode&randUa=1&url=` + encodeURIComponent(downUrl) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
        } else {
            urls.push("原代本", `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(downUrl));
        }

        return {
            parse: 0,
            url: urls,
            header: headers,
        }
        */

    }


    async testSupport(url, headers) {

        const resp = await req

            .get(url, {

                responseType: 'stream',

                headers: Object.assign(
                    {

                        Range: 'bytes=0-0',

                    },

                    headers,
                ),

            })

            .catch((err) => {

                // console.error(err);
                console.error('[testSupport] error:', err.message);

                return err.response || {status: 500, data: {}};

            });

        if (resp && resp.status === 206) {

            const isAccept = resp.headers['accept-ranges'] === 'bytes';

            const contentRange = resp.headers['content-range'];

            const contentLength = parseInt(resp.headers['content-length']);

            const isSupport = isAccept || !!contentRange || contentLength === 1;

            const length = contentRange ? parseInt(contentRange.split('/')[1]) : contentLength;

            delete resp.headers['content-range'];

            delete resp.headers['content-length'];

            if (length) resp.headers['content-length'] = length.toString();

            return [isSupport, resp.headers];

        } else {
            console.log('[testSupport] resp.status:', resp.status);
            return [false, null];

        }

    }


    delAllCache(keepKey) {

        try {

            fs.readdir(this.cacheRoot, (_, files) => {

                if (files)

                    for (const file of files) {

                        if (file === keepKey) continue;

                        const dir = join(this.cacheRoot, file);

                        fs.stat(dir, (_, stats) => {

                            if (stats && stats.isDirectory()) {

                                fs.readdir(dir, (_, subFiles) => {

                                    if (subFiles)

                                        for (const subFile of subFiles) {

                                            if (!subFile.endsWith('.p')) {

                                                fs.rm(join(dir, subFile), {recursive: true}, () => {
                                                });

                                            }

                                        }

                                });

                            }

                        });

                    }

            });

        } catch (error) {

            console.error(error);

        }

    }


    async chunkStream(inReq, outResp, url, urlKey, headers, option) {

        urlKey = urlKey || CryptoJS.enc.Hex.stringify(CryptoJS.MD5(url)).toString();

        if (this.currentUrlKey !== urlKey) {

            this.delAllCache(urlKey);

            this.currentUrlKey = urlKey;

        }

        if (!this.urlHeadCache[urlKey]) {

            const [isSupport, urlHeader] = await this.testSupport(url, headers);

            if (!isSupport || !urlHeader['content-length']) {

                outResp.redirect(url);

                return;

            }

            this.urlHeadCache[urlKey] = urlHeader;

        }

        let exist = true;

        await fs.promises.access(join(this.cacheRoot, urlKey)).catch((_) => (exist = false));

        if (!exist) {

            await fs.promises.mkdir(join(this.cacheRoot, urlKey), {recursive: true});

        }

        const contentLength = parseInt(this.urlHeadCache[urlKey]['content-length']);

        let byteStart = 0;

        let byteEnd = contentLength - 1;

        const streamHeader = {};

        if (inReq.headers.range) {

            const ranges = inReq.headers.range.trim().split(/=|-/);

            if (ranges.length > 2 && ranges[2]) {

                byteEnd = parseInt(ranges[2]);

            }

            byteStart = parseInt(ranges[1]);

            Object.assign(streamHeader, this.urlHeadCache[urlKey]);

            streamHeader['content-length'] = (byteEnd - byteStart + 1).toString();

            streamHeader['content-range'] = `bytes ${byteStart}-${byteEnd}/${contentLength}`;

            outResp.code(206);

        } else {

            Object.assign(streamHeader, this.urlHeadCache[urlKey]);

            outResp.code(200);

        }

        option = option || {chunkSize: 1024 * 256, poolSize: 5, timeout: 1000 * 10};

        const chunkSize = option.chunkSize;

        const poolSize = option.poolSize;

        const timeout = option.timeout;

        let chunkCount = Math.ceil(contentLength / chunkSize);

        let chunkDownIdx = Math.floor(byteStart / chunkSize);

        let chunkReadIdx = chunkDownIdx;

        let stop = false;

        const dlFiles = {};

        for (let i = 0; i < poolSize && i < chunkCount; i++) {

            new Promise((resolve) => {

                (async function doDLTask(spChunkIdx) {

                    if (stop || chunkDownIdx >= chunkCount) {

                        resolve();

                        return;

                    }

                    if (spChunkIdx === undefined && (chunkDownIdx - chunkReadIdx) * chunkSize >= this.maxCache) {

                        setTimeout(doDLTask, 5);

                        return;

                    }

                    const chunkIdx = spChunkIdx || chunkDownIdx++;

                    const taskId = `${inReq.id}-${chunkIdx}`;

                    try {

                        const dlFile = join(this.cacheRoot, urlKey, `${inReq.id}-${chunkIdx}.p`);

                        let exist = true;

                        await fs.promises.access(dlFile).catch((_) => (exist = false));

                        if (!exist) {

                            const start = chunkIdx * chunkSize;

                            const end = Math.min(contentLength - 1, (chunkIdx + 1) * chunkSize - 1);

                            console.log(inReq.id, chunkIdx);

                            const dlResp = await req.get(url, {

                                responseType: 'stream',

                                timeout: timeout,

                                headers: Object.assign(
                                    {

                                        Range: `bytes=${start}-${end}`,

                                    },

                                    headers,
                                ),

                            });

                            const dlCache = join(this.cacheRoot, urlKey, `${inReq.id}-${chunkIdx}.dl`);

                            const writer = fs.createWriteStream(dlCache);

                            const readTimeout = setTimeout(() => {

                                writer.destroy(new Error(`${taskId} read timeout`));

                            }, timeout);

                            const downloaded = new Promise((resolve) => {

                                writer.on('finish', async () => {

                                    if (stop) {

                                        await fs.promises.rm(dlCache).catch((e) => console.error(e));

                                    } else {

                                        await fs.promises.rename(dlCache, dlFile).catch((e) => console.error(e));

                                        dlFiles[taskId] = dlFile;

                                    }

                                    resolve(true);

                                });

                                writer.on('error', async (e) => {

                                    console.error(e);

                                    await fs.promises.rm(dlCache).catch((e1) => console.error(e1));

                                    resolve(false);

                                });

                            });

                            dlResp.data.pipe(writer);

                            const result = await downloaded;

                            clearTimeout(readTimeout);

                            if (!result) {

                                setTimeout(() => {

                                    doDLTask(chunkIdx);

                                }, 15);

                                return;

                            }

                        }

                        setTimeout(doDLTask, 5);

                    } catch (error) {

                        console.error(error);

                        setTimeout(() => {

                            doDLTask(chunkIdx);

                        }, 15);

                    }

                })();

            });

        }


        outResp.headers(streamHeader);

        const stream = new PassThrough();

        new Promise((resolve) => {

            let writeMore = true;

            (async function waitReadFile() {

                try {

                    if (chunkReadIdx >= chunkCount || stop) {

                        stream.end();

                        resolve();

                        return;

                    }

                    if (!writeMore) {

                        setTimeout(waitReadFile, 5);

                        return;

                    }

                    const taskId = `${inReq.id}-${chunkReadIdx}`;

                    if (!dlFiles[taskId]) {

                        setTimeout(waitReadFile, 5);

                        return;

                    }

                    const chunkByteStart = chunkReadIdx * chunkSize;

                    const chunkByteEnd = Math.min(contentLength - 1, (chunkReadIdx + 1) * chunkSize - 1);

                    const readFileStart = Math.max(byteStart, chunkByteStart) - chunkByteStart;

                    const dlFile = dlFiles[taskId];

                    delete dlFiles[taskId];

                    const fd = await fs.promises.open(dlFile, 'r');

                    const buffer = Buffer.alloc(chunkByteEnd - chunkByteStart - readFileStart + 1);

                    await fd.read(buffer, 0, chunkByteEnd - chunkByteStart - readFileStart + 1, readFileStart);

                    await fd.close().catch((e) => console.error(e));

                    await fs.promises.rm(dlFile).catch((e) => console.error(e));
                    writeMore = stream.write(buffer);
                    if (!writeMore) {
                        stream.once('drain', () => {
                            writeMore = true;
                        });
                    }
                    chunkReadIdx++;
                    setTimeout(waitReadFile, 5);
                } catch (error) {
                    setTimeout(waitReadFile, 5);
                }
            })();
        });
        stream.on('close', async () => {
            Object.keys(dlFiles).forEach((reqKey) => {
                if (reqKey.startsWith(inReq.id)) {
                    fs.rm(dlFiles[reqKey], {recursive: true}, () => {
                    });
                    delete dlFiles[reqKey];
                }
            });
            stop = true;
        });
        return stream;

    }
}

export const UC = new UCHandler();