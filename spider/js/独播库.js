/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '独播库',
  author: 'EylinSir',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '独播库',
    host: 'https://api.dbokutv.com',
    url: '/home',
    searchUrl: '/vodsearch',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    timeout: 10000,
    play_parse: true,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.duboku.tv/"
    },

    get: async function(path) {
        let url = this.getSignedUrl(path);
        let resp = await _fetch(url, { headers: this.headers });
        return JSON.parse(await resp.text());
    },

    format: function(list) {
        return (list || []).map(j => ({
            title: j.Name,
            url: `${this.host}${this.decodeData(j.DId || j.DuId)}`,
            desc: j.Tag,
            pic_url: this.decodeData(j.TnId),
            vod_id: this.decodeData(j.DId || j.DuId)
        }));
    },

    class_parse: async function() {
        return {
            class: [{ type_id: '2', type_name: '连续剧' }, { type_id: '1', type_name: '电影' }, { type_id: '3', type_name: '综艺' }, { type_id: '4', type_name: '动漫' }],
            filters: {}
        };
    },

    推荐: async function() {
        let json = await this.get('/home');
        let videos = [];
        (json || []).forEach(g => videos.push(...this.format(g.VodList)));
        return setResult(videos);
    },

    一级: async function(tid, pg) {
        let page = (pg || 1).toString();
        let data = await this.get(`/vodshow/${tid}--------${page === '1' ? '' : page}---`);
        return setResult(this.format(data.VodList));
    },

    二级: async function() {
        let id = this.input.replace(this.host, '');
        let data = await this.get(id);
        if (!data) return {};
        let playUrls = (data.Playlist || []).map(i => 
            `${i.EpisodeName}$${this.decodeData(i.VId)}`
        ).join('#');
        return {
            vod_id: id,
            vod_name: data.Name,
            vod_pic: this.decodeData(data.TnId),
            vod_remarks: `评分：${data.Rating}`,
            vod_year: data.ReleaseYear,
            vod_area: data.Region,
            vod_actor: Array.isArray(data.Actor) ? data.Actor.join(',') : data.Actor,
            vod_director: data.Director,
            vod_content: data.Description,
            vod_play_from: '独播库',
            vod_play_url: playUrls,
            type_name: `${data.Genre || ''},${data.Scenario || ''}`
        };
    },

    搜索: async function() {
        let data = await this.get(`/vodsearch?wd=${encodeURIComponent(this.KEY)}`);
        let url = this.getSignedUrl('/vodsearch') + `&wd=${encodeURIComponent(this.KEY)}`;
        let resp = await _fetch(url, { headers: this.headers });
        return setResult(this.format(JSON.parse(await resp.text())));
    },

    lazy: async function() {
        let id = this.input.replace(this.host, '');
        let res = await this.get(id);
        return {
            parse: 0,
            url: this.decodeData(res.HId),
            header: {
                'User-Agent': this.headers['User-Agent'],
                'Origin': 'https://w.duboku.io',
                'Referer': 'https://w.duboku.io/'
            }
        };
    },

    getSignedUrl: function(path) {
        const ts = Math.floor(Date.now() / 1000).toString();
        const rand = Math.floor(Math.random() * 800000001);
        const combined = (rand + 100000000).toString() + (900000000 - rand).toString();
        let interleaved = '';
        const len = Math.min(combined.length, ts.length);
        for (let i = 0; i < len; i++) interleaved += combined[i] + ts[i];
        interleaved += combined.substring(len) + ts.substring(len);
        const ssid = this.base64Encode(interleaved).replace(/=/g, '.');
        const rStr = (l) => Array(l).fill(0).map(() => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
        return `${this.host}${path}${path.includes('?') ? '&' : '?'}sign=${rStr(60)}&token=${rStr(38)}&ssid=${ssid}`;
    },

    decodeData: function(data) {
        if (!data || typeof data !== 'string') return '';
        let str = data.replace(/['"]/g, '').trim();
        if (!str) return '';
        let res = '';
        for (let i = 0; i < str.length; i += 10) {
            res += str.substring(i, i + 10).split('').reverse().join('');
        }
        try { return this.base64Decode(res.replace(/\./g, '=')); } catch (e) { return ''; }
    },

    base64Encode: function(t) {
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let o = '', i = 0;
        while (i < t.length) {
            let n = (t.charCodeAt(i) << 16) | (t.charCodeAt(i + 1) << 8) | t.charCodeAt(i + 2);
            o += c.charAt((n >> 18) & 63) + c.charAt((n >> 12) & 63) + c.charAt((n >> 6) & 63) + c.charAt(n & 63);
            i += 3;
        }
        let m = t.length % 3;
        return m ? o.slice(0, m - 3) + "===".substring(m) : o;
    },

    base64Decode: function(s) {
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        s = s.replace(/=/g, '');
        let o = '', i = 0;
        while (i < s.length) {
            let n = (c.indexOf(s.charAt(i)) << 18) | (c.indexOf(s.charAt(i + 1)) << 12) | (c.indexOf(s.charAt(i + 2)) << 6) | c.indexOf(s.charAt(i + 3));
            o += String.fromCharCode((n >> 16) & 255, (n >> 8) & 255, n & 255);
            i += 4;
        }
        return o.replace(/\0/g, '');
    }
};