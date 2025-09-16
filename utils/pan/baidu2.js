import '../../libs_drpy/jsencrypt.js'
import {ENV} from "../env.js";
import axios from "axios";

// 秋秋的百度
class BaiduDrive {
    constructor() {
        this.regex = /https:\/\/pan\.baidu\.com\/s\/(.*)\?.*?pwd=([^&]+)/;//https://pan.baidu.com/s/1kbM0KWLDpeS8I49tmwS6lQ?pwd=74j5
        this.type = ["M3U8_AUTO_4K", "M3U8_AUTO_2K", "M3U8_AUTO_1080", "M3U8_AUTO_720", "M3U8_AUTO_480"];
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Connection": "keep-alive",
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6"
        };
        this.api = 'https://pan.baidu.com';
        this.link = ''
        this.pwd = '';
        this.surl = '';
        this.shorturl = ''
        this.shareid = '';
        this.app_id = 250528;
        this.view_mode = 1;
        this.channel = 'chunlei';

    }

    // 初始化方法，加载本地配置
    async init() {
        if (this.cookie) {
            console.log('百度网盘cookie获取成功' + this.cookie)
        }
    }

    get cookie() {
        return ENV.get('baidu_cookie')
    }

    async getSurl(url) {
        this.link = url
        const matches = this.regex.exec(url);
        if (matches && matches[1]) {
            this.surl = matches[1];
            this.shorturl = this.surl.split('').slice(1).join('')
            this.pwd = matches[2] || '';
        }
    }

    async getSign() {
        let data = (await axios.get(`${this.api}/share/tplconfig?surl=${this.surl}&fields=Espace_info,card_info,sign,timestamp&view_mode=${this.view_mode}&channel=${this.channel}&web=1&app_id=${this.app_id}`, {
            headers: this.headers
        })).data
        return data.data.sign
    }

    async getShareData(link) {
        await this.getSurl(link)
        return await this.getShareList()
    }


    async getRandsk() {
        let data = qs.stringify({
            'pwd': this.pwd,
            'vcode': '',
            'vcode_str': ''
        });
        let randsk = (await axios.post(`${this.api}/share/verify?surl=${this.shorturl}&pwd=${this.pwd}`, data, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Referer': this.link,
            }
        })).data.randsk
        let BDCLND = "BDCLND=" + randsk
        if (!this.cookie.includes('BDCLND')) {
            let cookie = this.cookie + BDCLND
            ENV.set('baidu_cookie', cookie)
            return randsk
        } else {
            let cookie = this.cookie.split(';').map(it => {
                if (/BDCLND/.test(it)) {
                    it = BDCLND
                }
                return it
            }).join(';')
            ENV.set('baidu_cookie', cookie);
            return randsk
        }

    }


    async getShareList() {
        await this.getRandsk()
        this.headers['cookie'] = this.cookie
        let data = (await axios.get(`${this.api}/share/list?web=5&app_id=${this.app_id}&desc=1&showempty=0&page=1&num=20&order=time&shorturl=${this.shorturl}&root=1&view_mode=${this.view_mode}&channel=${this.channel}&web=1&clienttype=0`, {
            headers: this.headers
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            let file = {}
            let dirs = []
            let videos = []
            this.uk = data.uk
            this.shareid = data.share_id
            data.list.map(item => {
                if (item.category === '6' || item.category === 6) {
                    dirs.push(item.path)
                }
                if (item.category === '1' || item.category === 1) {
                    // 确保所有情况下都提取文件名
                    const fileName = item.server_filename || item.path.split('/').pop();
                    videos.push({
                        name: fileName, // 只使用文件名
                        path: item.path, // 保留完整路径用于内部处理
                        uk: this.uk,
                        shareid: this.shareid,
                        fsid: item.fs_id || item.fsid
                    })
                }
            });
            if (!(data.title in file) && data.title !== undefined) {
                file[data.title] = [];
            }
            if (videos.length >= 0 && data.title !== undefined) {
                file[data.title] = [...videos]
            }
            let result = await Promise.all(dirs.map(async (path) => this.getSharepath(path)))
            result = result.filter(item => item !== undefined && item !== null).flat()
            if (result.length >= 0) {
                // 确保递归获取的文件也正确处理文件名
                const processedResult = result.map(item => {
                    if (item.name && item.name.includes('/')) {
                        item.name = item.name.split('/').pop();
                    }
                    return item;
                });
                file[data.title].push(...processedResult);
            }
            return file;
        }
    }

    async getSharepath(path) {
        await this.getRandsk()
        this.headers['cookie'] = this.cookie
        let data = (await axios.get(`${this.api}/share/list?is_from_web=true&uk=${this.uk}&shareid=${this.shareid}&order=name&desc=0&showempty=0&view_mode=${this.view_mode}&web=1&page=1&num=100&dir=${path}&channel=${this.channel}&web=1&app_id=${this.app_id}`, {
            headers: this.headers
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            let dirs = []
            let videos = []
            data.list.map(item => {
                if (item.category === '6' || item.category === 6) {
                    dirs.push(item.path)
                }
                if (item.category === '1' || item.category === 1) {
                    // 确保所有情况下都提取文件名
                    const fileName = item.server_filename || item.path.split('/').pop();
                    videos.push({
                        name: fileName, // 只使用文件名
                        path: item.path, // 保留完整路径用于内部处理
                        uk: this.uk,
                        shareid: this.shareid,
                        fsid: item.fs_id || item.fsid
                    })
                }
            });
            let result = await Promise.all(dirs.map(async (path) => this.getSharepath(path)))
            result = result.filter(item => item !== undefined && item !== null);

            // 确保递归获取的文件也正确处理文件名
            const processedResult = result.map(item => {
                if (item.name && item.name.includes('/')) {
                    item.name = item.name.split('/').pop();
                }
                return item;
            });

            return [...videos, ...processedResult.flat()];
        }
    }

    async getShareUrl(path, uk, shareid, fsid) {
        let sign = await this.getSign()
        let urls = []
        let t = Math.floor(new Date() / 1000);
        this.type.map(it => {
            urls.push({
                name: it.replace('M3U8_AUTO_', ''),
                url: `${this.api}/share/streaming?channel=${this.channel}&uk=${uk}&fid=${fsid}&sign=${sign}&timestamp=${t}&shareid=${shareid}&type=${it}&vip=0&jsToken&isplayer=1&check_blue=1&adToken`
            })
        })
        return urls
    }

    async getUid() {
        let data = (await axios.get('https://mbd.baidu.com/userx/v1/info/get?appname=baiduboxapp&fields=%20%20%20%20%20%20%20%20%5B%22bg_image%22,%22member%22,%22uid%22,%22avatar%22,%20%22avatar_member%22%5D&client&clientfrom&lang=zh-cn&tpl&ttt', {
            headers: this.headers
        })).data
        return data.data.fields.uid
    }

    sha1(message) {
        return CryptoJS.SHA1(message).toString(CryptoJS.enc.Hex);
    }

    async getAppShareUrl(path, uk, shareid, fsid) {
        let BDCLND = await this.getRandsk()
        let uid = await this.getUid()
        let header = Object.assign({}, this.headers, {
            "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;',
        });
        let devuid = "73CED981D0F186D12BC18CAE1684FFD5|VSRCQTF6W";
        let time = String(new Date().getTime());
        let rand = this.sha1(this.sha1(this.cookie.match(/BDUSS=(.+?);/)[1]) + uid + "ebrcUYiuxaZv2XGu7KIYKxUrqfnOfpDF" + time + devuid + "11.30.2ae5821440fab5e1a61a025f014bd8972");
        let url = this.api + "/share/list?shareid=" + shareid + "&uk=" + uk + "&fid=" + fsid + "&sekey=" + BDCLND + "&origin=dlna&devuid=" + devuid + "&clienttype=1&channel=android_12_zhao_bd-netdisk_1024266h&version=11.30.2&time=" + time + "&rand=" + rand;
        let data = (await axios.get(url, {
            headers: header
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            // let relink = await axios.get(link,{
            //     headers:header,
            //     redirect: false,
            //     onlyHeaders: true
            // })
            // console.log(relink)
            return data.list[0].dlink
        }
    }
}


export const Baidu2 = new BaiduDrive();