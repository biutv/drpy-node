/**
 * 123网盘API操作类
 * 提供123网盘的文件分享、下载、播放等功能
 */

import axios from "axios";
import {ENV} from "../env.js";
import {base64Decode} from "../../libs_drpy/crypto-util.js";

/**
 * 123网盘操作类
 * 支持文件分享链接解析、文件列表获取、下载链接生成等功能
 */
class Pan123 {
    constructor() {
        // 支持的123网盘域名正则表达式
        this.regex = /https:\/\/(www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com)\/s\/([^\\/]+)/
        this.api = 'https://www.123684.com/b/api/share/';
        this.loginUrl = 'https://login.123pan.com/api/user/sign_in';
        this.cate = ''
    }

    /**
     * 初始化方法，检查登录状态
     */
    async init() {
        if (this.passport) {
            console.log("获取盘123账号成功")
        }
        if (this.password) {
            console.log("获取盘123密码成功")
        }
        if (this.auth) {
            // 解析JWT token检查是否过期
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

    // 获取账号
    get passport() {
        return ENV.get('pan_passport')
    }

    // 获取密码
    get password() {
        return ENV.get('pan_password')
    }

    // 获取认证token
    get auth() {
        return ENV.get('pan_auth')
    }

    /**
     * 登录方法
     */
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

        // 发送登录请求并保存token
        let auth = (await axios.request(config)).data
        ENV.set('pan_auth', auth.data.token)
    }

    /**
     * 解析分享链接，提取分享密钥和提取码
     * @param {string} url 分享链接
     * @returns {string|null} 分享密钥
     */
    getShareData(url) {
        this.SharePwd = ''
        url = decodeURIComponent(url);
        // 处理提取码格式
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
        // 提取分享密码
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

    /**
     * 根据分享链接获取文件列表
     * @param {string} shareKey 分享密钥
     * @returns {Object} 文件列表对象
     */
    async getFilesByShareUrl(shareKey) {
        let file = {}
        // 获取分享信息
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

    /**
     * 获取分享信息
     * @param {string} shareKey 分享密钥
     * @param {string} SharePwd 分享密码
     * @param {number} next 下一页标识
     * @param {number} ParentFileId 父文件夹ID
     * @returns {Array} 分类信息数组
     */
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
                // 处理文件夹
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
                // 如果没有文件夹，处理视频文件
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
                // 递归获取子文件夹信息
                let result = await Promise.all(cate.map(async (it) => this.getShareInfo(shareKey, SharePwd, next, it.fileId)));
                result = result.filter(item => item !== undefined && item !== null);
                return [...cate, ...result.flat()];
            }
        }
    }

    /**
     * 获取分享文件列表
     * @param {string} shareKey 分享密钥
     * @param {string} SharePwd 分享密码
     * @param {number} next 下一页标识
     * @param {number} ParentFileId 父文件夹ID
     * @returns {Array} 视频文件列表
     */
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
        // 筛选视频文件
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

    /**
     * 获取文件下载链接
     * @param {string} shareKey 分享密钥
     * @param {string} FileId 文件ID
     * @param {string} S3KeyFlag S3密钥标识
     * @param {number} Size 文件大小
     * @param {string} Etag 文件标签
     * @returns {string} 解码后的下载链接
     */
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

    /**
     * 获取视频在线播放链接
     * @param {string} shareKey 分享密钥
     * @param {string} FileId 文件ID
     * @param {string} S3KeyFlag S3密钥标识
     * @param {number} Size 文件大小
     * @param {string} Etag 文件标签
     * @returns {Array} 不同清晰度的播放链接数组
     */
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
            // 处理不同清晰度的播放链接
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

// 导出Pan123实例
export const Pan = new Pan123();