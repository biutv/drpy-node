import axios from "axios";
import {ENV} from "../env.js";
import {base64Decode} from "../../libs_drpy/crypto-util.js";


class Pan123 {
    constructor() {
        this.regex = /https:\/\/(www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com)\/s\/([^\\/]+)/
        this.api = 'https://www.123684.com/b/api/share/';
        this.loginUrl = 'https://login.123pan.com/api/user/sign_in';
        this.cate = ''
    }

    async init() {
        if (this.passport) {
            console.log("获取盘123账号成功")
        }
        if (this.password) {
            console.log("获取盘123密码成功")
        }
        if (this.auth) {
            let info = JSON.parse(CryptoJS.enc.Base64.parse(this.auth.split('.')[1]).toString(CryptoJS.enc.Utf8))
            if (info.exp > Math.floor(Date.now() / 1000)) {
                console.log("登录成功")
            } else {
                console.log("登录过期，重新登录")
                await this.loin()
            }
        } else {
            console.log("尚未登录，开始登录")
            await this.loin()
        }
    }

    get passport() {
        return ENV.get('pan_passport')
    }

    get password() {
        return ENV.get('pan_password')
    }

    get auth() {
        return ENV.get('pan_auth')
    }

    async loin() {
        let data = JSON.stringify({
            "passport": this.passport,
            "password": this.password,
            "remember": true
        });
        let config = {
            method: 'POST',
            url: this.loginUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'App-Version': '43',
                'Referer': 'https://login.123pan.com/centerlogin?redirect_url=https%3A%2F%2Fwww.123684.com&source_page=website',
            },
            data: data
        };

        let auth = (await axios.request(config)).data
        ENV.set('pan_auth', auth.data.token)
    }

    getShareData(url) {
        this.SharePwd = ''
        url = decodeURIComponent(url);
        if (url.indexOf('提取码') > 0 && url.indexOf('?') < 0) {
            url = url.replace(/提取码:|提取码|提取码：/g, '?')
        }
        if (url.indexOf('提取码') > 0 && url.indexOf('?') > 0) {
            url = url.replace(/提取码:|提取码|提取码：|/g, '')
        }
        if (url.indexOf('：') > 0) {
            url = url.replace('：', '')
        }
        const matches = this.regex.exec(url);
        if (url.indexOf('?') > 0) {
            this.SharePwd = url.split('?')[1].match(/[A-Za-z0-9]+/)[0];
            console.log(this.SharePwd)
        }
        if (matches) {
            if (matches[2].indexOf('?') > 0) {
                return matches[2].split('?')[0]
            } else if (matches[2].indexOf('html') > 0) {
                return matches[2].replace('.html', '')
            } else {
                return matches[2].match(/www/g) ? matches[1] : matches[2];
            }

        }
        return null;
    }

    async getFilesByShareUrl(shareKey) {
        let file = {}
        let cate = await this.getShareInfo(shareKey, this.SharePwd, 0, 0)
        if (cate && Array.isArray(cate)) {
            await Promise.all(cate.map(async (item) => {
                if (!(item.filename in file)) {
                    file[item.filename] = [];
                }
                const fileData = await this.getShareList(item.shareKey, item.SharePwd, item.next, item.fileId);
                if (fileData && fileData.length > 0) {
                    file[item.filename].push(...fileData);
                }
            }));
        }
        // 过滤掉空数组
        for (let key in file) {
            if (file[key].length === 0) {
                delete file[key];
            }
        }
        return file;
    }

    async getShareInfo(shareKey, SharePwd, next, ParentFileId) {
        let cate = []
        let list = await axios.get(this.api + `get?limit=100&next=${next}&orderBy=file_name&orderDirection=asc&shareKey=${shareKey.trim()}&SharePwd=${SharePwd || ''}&ParentFileId=${ParentFileId}&Page=1`, {
            headers: {},
        });
        if (list.status === 200) {
            if (list.data.code === 5103) {
                console.log(list.data.message);
            } else {
                let info = list.data.data;
                let next = info.Next;
                let infoList = info.InfoList
                infoList.forEach(item => {
                    if (item.Category === 0) {
                        cate.push({
                            filename: item.FileName,
                            shareKey: shareKey,
                            SharePwd: SharePwd,
                            next: next,
                            fileId: item.FileId
                        });
                    }
                })
                if (cate.length === 0) {
                    infoList.forEach(item => {
                        if (item.Category === 2) {
                            cate.push({
                                filename: item.FileName,
                                shareKey: shareKey,
                                SharePwd: SharePwd,
                                next: next,
                                fileId: item.FileId
                            });
                        }
                    })
                }
                let result = await Promise.all(cate.map(async (it) => this.getShareInfo(shareKey, SharePwd, next, it.fileId)));
                result = result.filter(item => item !== undefined && item !== null);
                return [...cate, ...result.flat()];
            }
        }
    }

    async getShareList(shareKey, SharePwd, next, ParentFileId) {
        let video = []
        let link = this.api + `get?limit=100&next=${next}&orderBy=file_name&orderDirection=asc&shareKey=${shareKey.trim()}&SharePwd=${SharePwd || ''}&ParentFileId=${ParentFileId}&Page=1`
        let infoList = (await axios.request({
            method: 'get',
            url: link,
            headers: {},
        })).data;
        if (infoList.data.Next === '') {
            let list = await this.getShareList(shareKey, SharePwd, 0, 0)
            list.forEach(it => {
                video.push({
                    ShareKey: shareKey,
                    FileId: it.FileId,
                    S3KeyFlag: it.S3KeyFlag,
                    Size: it.Size,
                    Etag: it.Etag,
                    FileName: it.FileName,
                })
            })
        }
        infoList.data.InfoList.forEach(it => {
            if (it.Category === 2) {
                video.push({
                    ShareKey: shareKey,
                    FileId: it.FileId,
                    S3KeyFlag: it.S3KeyFlag,
                    Size: it.Size,
                    Etag: it.Etag,
                    FileName: it.FileName,
                })
            }
        })
        return video;
    }

    async getDownload(shareKey, FileId, S3KeyFlag, Size, Etag) {
        await this.init();
        let data = JSON.stringify({
            "ShareKey": shareKey,
            "FileID": FileId,
            "S3KeyFlag": S3KeyFlag,
            "Size": Size,
            "Etag": Etag
        });
        let config = {
            method: 'POST',
            url: `${this.api}download/info`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${this.auth}`,
                'Content-Type': 'application/json;charset=UTF-8',
                'platform': 'android',
            },
            data: data
        };
        let down = (await axios.request(config)).data.data
        return base64Decode((new URL(down.DownloadURL)).searchParams.get('params'));
    }

    async getLiveTranscoding(shareKey, FileId, S3KeyFlag, Size, Etag) {
        await this.init();
        let config = {
            method: 'GET',
            url: `https://www.123684.com/b/api/video/play/info`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${this.auth}`,
                'Content-Type': 'application/json;charset=UTF-8',
                'platform': 'android',
            },
            params: {
                "etag": Etag,
                "size": Size,
                "from": "1",
                "shareKey": shareKey
            }
        };
        let down = (await axios.request(config)).data.data
        if (down?.video_play_info) {
            let videoinfo = []
            down.video_play_info.forEach(item => {
                if (item.url !== '') {
                    videoinfo.push({
                        name: item.resolution,
                        url: item.url
                    })
                }
            })
            return videoinfo;
        }
        return []
    }
}

export const Pan = new Pan123();