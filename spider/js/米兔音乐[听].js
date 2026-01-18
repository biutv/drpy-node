/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '米兔音乐',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
  title: '米兔音乐',
  host: 'https://api.qqmp3.vip',
  url: '/api/fyclass',
  searchUrl: '/api/songs.php?type=search&keyword=**',
  class_name: '热门歌曲&新歌曲&随机歌曲',
  class_url: 'songs.php&songs.php?type=new&songs.php?type=rand',
  searchable: 2,
  quickSearch: 0,
  filterable: 0,
  play_parse: true,
  limit: 6,
  double: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; V2284A Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36',
    'Accept': '*/*',
    'Origin': 'https://www.qqmp3.vip',
    'referer': 'https://www.qqmp3.vip',
    'x-requested-with': 'com.mmbox.xbrowser',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
  },
  推荐: '*',
  一级: 'json:data;name;pic;artist;rid',
  二级: '*',
  搜索: 'json:data;name;pic;artist;rid',
  lazy: async function() {
    let ridMatch = this.input.match(/api\/([^/?]+)/);
    if (!ridMatch) return this.input;
    let rid = ridMatch[1];
    let api = 'https://api.qqmp3.vip/api/kw.php?rid=' + rid;
  //  console.log('解析接口:', api);
    let json = await request(api);
    let data = JSON.parse(json);
    if (data.code === 200 && data.data?.url) {
        return {
            parse: 0,
            url: data.data.url,
            header: this.headers,
            lrc: data.data.lrc || '',
            playMode: 'repeat'
        };
    }
    return this.input;
  },
};