import axios from "axios";
import CryptoJS from "crypto-js";
import {ENV} from "../env.js";

class YunDrive {
    constructor() {
        this.regex = /https:\/\/yun.139.com\/shareweb\/#\/w\/i\/([^&]+)/;
        this.x = CryptoJS.enc.Utf8.parse("PVGDwmcvfs1uV3d1");
        this.baseUrl = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/';
        this.baseHeader = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'hcy-cool-flag': '1',
            'x-deviceinfo': '||3|12.27.0|chrome|131.0.0.0|5c7c68368f048245e1ce47f1c0f8f2d0||windows 10|1536X695|zh-CN|||'
        };
        this.linkID = '';
        this.cache = {}; // 添加缓存对象
        this.authorization = ''
    }

    async init() {
        if (this.cookie) {
            console.log('移动cookie获取成功' + this.cookie)
            const cookie = this.cookie.split(';');
            if (this.authorization === '') {
                cookie.forEach((item) => {
                    if (item.indexOf('authorization') !== -1) {
                        this.authorization = item.replace('authorization=', '');
                        console.log('authorization获取成功:' + this.authorization)
                    }
                })
            }
        } else {
            console.error("请先获取移动cookie")
        }
        if (this.account) {
            console.log("移动账号获取成功")
        }
    }

    get cookie() {
        return ENV.get('yun_cookie')
    }

    get account() {
        return ENV.get('yun_account')
    }

    encrypt(data) {
        let t = CryptoJS.lib.WordArray.random(16), n = "";
        if ("string" == typeof data) {
            const o = CryptoJS.enc.Utf8.parse(data);
            n = CryptoJS.AES.encrypt(o, this.x, {iv: t, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7});
        } else if (typeof data === 'object' && data !== null) {
            const a = JSON.stringify(data), s = CryptoJS.enc.Utf8.parse(a);
            n = CryptoJS.AES.encrypt(s, this.x, {iv: t, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7});
        }
        return CryptoJS.enc.Base64.stringify(t.concat(n.ciphertext));
    }

    decrypt(data) {
        const t = CryptoJS.enc.Base64.parse(data), n = t.clone(), i = n.words.splice(4);
        n.init(n.words), t.init(i);
        const o = CryptoJS.enc.Base64.stringify(t),
            a = CryptoJS.AES.decrypt(o, this.x, {iv: n, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7}),
            s = a.toString(CryptoJS.enc.Utf8);
        return s.toString();
    }

    async getShareID(url) {
        const matches = this.regex.exec(url) || /https:\/\/caiyun.139.com\/m\/i\?([^&]+)/.exec(url);
        if (matches && matches[1]) {
            this.linkID = matches[1];
        }
    }

    async getShareInfo(pCaID) {
        if (!this.linkID) {
            console.error('linkID is not set. Please call getShareID first.');
            return null;
        }
        const cacheKey = `${this.linkID}-${pCaID}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }
        let data = JSON.stringify(this.encrypt(JSON.stringify({
            "getOutLinkInfoReq": {
                "account": "",
                "linkID": this.linkID,
                "passwd": "",
                "caSrt": 1,
                "coSrt": 1,
                "srtDr": 0,
                "bNum": 1,
                "pCaID": pCaID,
                "eNum": 200
            },
            "commonAccountInfo": {"account": "", "accountType": 1}
        })));
        try {
            const resp = await axios.post(this.baseUrl + 'getOutLinkInfoV6', data, {headers: this.baseHeader});
            if (resp.status !== 200) {
                return null;
            }
            const json = JSON.parse(this.decrypt(resp.data)).data;
            this.cache[cacheKey] = json; // 缓存结果
            return json;
        } catch (error) {
            console.error('Error processing share info:', error);
            return null;
        }
    }

    async getShareData(url) {
        if (!url) {
            return {};
        }
        const isValidUrl = url.startsWith('http');
        let pCaID = isValidUrl ? 'root' : url;
        if (isValidUrl) {
            await this.getShareID(url);
        }
        let file = {};
        let fileInfo = await this.getShareFile(pCaID);
        if (fileInfo && Array.isArray(fileInfo)) {
            await Promise.all(fileInfo.map(async (item) => {
                if (!(item.name in file)) {
                    file[item.name] = [];
                }
                let filelist = await this.getShareUrl(item.path);
                if (filelist && filelist.length > 0) {
                    file[item.name].push(...filelist);
                }
            }));
        }
        for (let key in file) {
            if (file[key].length === 0) {
                delete file[key];
            }
        }
        if (Object.keys(file).length === 0) {
            file['root'] = await this.getShareFile(url);
            if (file['root'] && Array.isArray(file['root'])) {
                file['root'] = file['root'].filter(item => item && Object.keys(item).length > 0);
            }
        }
        return file;
    }

    async getShareFile(pCaID) {
        if (!pCaID) {
            return null;
        }
        try {
            const isValidUrl = pCaID.startsWith('http');
            pCaID = isValidUrl ? 'root' : pCaID;
            const json = await this.getShareInfo(pCaID);
            if (!json || !json.caLst) {
                return null;
            }
            const caLst = json?.caLst;
            const names = caLst.map(it => it.caName);
            const rootPaths = caLst.map(it => it.path);
            const filterRegex = /App|活动中心|免费|1T空间|免流/;
            const videos = [];
            if (caLst && caLst.length > 0) {
                names.forEach((name, index) => {
                    if (!filterRegex.test(name)) {
                        videos.push({name: name, path: rootPaths[index]});
                    }
                });
                let result = await Promise.all(rootPaths.map(async (path) => this.getShareFile(path)));
                result = result.filter(item => item !== undefined && item !== null);
                return [...videos, ...result.flat()];
            }
        } catch (error) {
            console.error('Error processing share data:', error);
            return null;
        }
    }

    async getShareUrl(pCaID) {
        try {
            const json = await this.getShareInfo(pCaID);
            if (!json || !('coLst' in json)) {
                return null;
            }
            const coLst = json.coLst;
            if (coLst !== null) {
                const filteredItems = coLst.filter(it => it && it.coType === 3);
                return filteredItems.map(it => ({
                    name: it.coName,
                    contentId: it.path,
                    linkID: this.linkID
                }));
            } else if (json.caLst !== null) {
                const rootPaths = json.caLst.map(it => it.path);
                let result = await Promise.all(rootPaths.map(path => this.getShareUrl(path)));
                result = result.filter(item => item && item.length > 0);
                return result.flat();
            }
        } catch (error) {
            console.error('Error processing share URL:', error);
            return null;
        }
    }

    async getSharePlay(contentId, linkID) {
        let data = {
            "getContentInfoFromOutLinkReq": {
                "contentId": contentId.split('/')[1],
                "linkID": linkID,
                "account": ""
            },
            "commonAccountInfo": {
                "account": "",
                "accountType": 1
            }
        };
        let resp = await axios.post(this.baseUrl + 'getContentInfoFromOutLink', data, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'application/json'
            }
        })
        if (resp.status === 200 && resp.data.data !== null) {
            let data = resp.data
            return data.data.contentInfo.presentURL
        }
    }

    async getDownload(contentId, linkID) {
        await this.init()
        let data = this.encrypt(JSON.stringify({
            "dlFromOutLinkReqV3": {
                "linkID": linkID,
                "account": this.account,
                "coIDLst": {
                    "item": [contentId]
                }
            },
            "commonAccountInfo": {
                "account": this.account,
                "accountType": 1
            }
        }));
        let resp = await axios.post(this.baseUrl + 'dlFromOutLinkV3', data, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                "Connection": "keep-alive",
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br",
                "Content-Type": "application/json",
                "accept-language": "zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
                "authorization": this.authorization,
                "content-type": "application/json;charset=UTF-8",
                'hcy-cool-flag': '1',
                'x-deviceinfo': '||3|12.27.0|chrome|136.0.0.0|189f4426ca008b9cbe9bf9bd79723d77||windows 10|1536X695|zh|||'
            }
        })
        if (resp.status === 200) {
            let json = JSON.parse(this.decrypt(resp.data))
            return json.data.redrUrl
        }

    }
}

export const Yun = new YunDrive();
