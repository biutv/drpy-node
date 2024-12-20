# drpyS更新记录

### 20241215

更新至V1.0.11

1. drpyS源pathLib对象增加readFile方法，支持读取data目录的指定文件，使用示例:

```javascript
const indexHtml = pathLib.readFile('./cntv/index.html');
```

2. 央视代理增加返回网页示例，用于平替cntvParser项目。关联首页的【央视点播解析工具】
3. 增加qs工具,drpyS源里可以直接使用，示例:

```javascript
log(qs.stringify({a: 1, b: 2}))
```

4. 在.env文件中加入 `LOG_WITH_FILE = 1` 可以使请求日志输出到文件，不配置则默认输出到控制台
5. 支持vercel部署，首页报错找不到readme.md无关大雅，能用就行,直接访问部署好的服务地址/config/1
6. 支持自定义解析。放在jx目录的js文件

### 20241213

更新至V1.0.10

1. axios变动，libs_drpy目录保留esm版axios,public目录保留全平台版axios。req封装采用node的axios。解决请求的set-cookie不正确问题
2. 增加异步导入模块功能$.import。支持远程模块(请务必保证模块的正确性，不然可能导致后端服务挂掉)
   用法示例,详见_fq3.js

```javascript
const {getIp} = await $.import('http://127.0.0.1:5757/public/ip.js');
var rule = {
    class_parse: async () => {
        log('ip:', await getIp());
    },
}
```

### 20241212

更新至V1.0.9

1. drpyS加解密工具增加文本大小限制，目前默认为100KB，防止垃圾大数据恶意攻击接口服务
2. 修复央视大全本地代理接口没有动态获取导致可能外网播放地址出现127开头内网地址无法播放的问题
3. 升级axios单文件版到1.7.9
4. 往libsSanbox注入eval函数(非直接注入，仅针对海阔，直接注入会用不了)，暂时解决海阔不支持vm里执行eval的问题,但是问题来了，存在作用域问题不要轻易使用，暂时无法解决。(
   已检测此eval不可以逃逸vm和直接获取drpyS内的变量，勉强能用)
5. 尝试$.require支持网络导入远程js依赖，要求1s内的数据(千万不要导入自己服务的静态文件，会导致阻塞)

### 20241211

更新至V1.0.8

1. BatchFetch默认采用fastq实现，支持海阔，性能强劲
2. 海阔存在写源里不支持eval问题，单任务版也不行。后续尽量避免eval，多采用JSON或JSON5处理
3. 添加axios,URL,pathLib等函数给ds源使用，推荐只在_lib库里使用
4. 支持wasm使用。
5. 新增加字符串扩展方法join，用法同python
6. 完善满血版央视大全,超越hipy版cntv
7. 本地代理增加proxyPath注入至this变量

### 20241210

更新至V1.0.7

1. 新增drpyBatchFetch.js、用3种不同方式实现drpy的batchFetch批量请求函数
2. 引入hls-parser库用于解析处理m3u8等流媒体文件，在drpyS中提供全局对象hlsParser
3. 新增央视
4. 修复人人
5. 完善batchFetch的4种实现方案

### 20241209

更新至V1.0.6

1. 新增特性，可以不写class_parse属性(但是得确保class_name和class_url不然无法获取分类)
2. 增加腾云驾雾源,修正搜索只能一个结果的问题。
3. 新增batchFetch批量请求，给drpyS源提速！！！腾云驾雾源的二级请求已提速，几百个播放链接的动漫二级秒加载
4. 增加ptt[优],同样支持二级batchFetch
5. 海阔暂不支持源里执行eval,腾云驾雾二级访问不了，现在临时修改为

```javascript
QZOutputJson = JSON5.parse(ht.split('QZOutputJson=')[1].slice(0, -1));
```

6. 手写队列，兼容海阔nodejs单任务版不支持queque等三方模块的问题
7. 修复pdfh不含属性解析的情况下返回结果不是字符串问题与之影响的黑料源

### 20241208

更新至V1.0.5

1. 新增函数 getContentType、getMimeType，替代原docs.js里的用法，并注入给drpyS源使用
2. drpyS支持class_name,class_url,filter等属性了
3. 星芽短剧新增筛选
4. 新增源老白故事
5. 优化首页分类接口机制，支持在class_parse里返回list,然后推荐留空。
6. 推荐函数注入this变量
7. 兼容新版海阔多任务nodejs

### 20241207

更新至V1.0.4

1. 添加源【动漫巴士】
2. 修改headless-util.js
3. 增加hostJs异步函数，使用示例:
4. 优化会员解密功能
5. 优化访问日志输出到本地文件并自动轮转
6. 黑料源使用CryptoJSW提高图片解密速度
7. 优化yarn dev解决控制台日志乱码问题
8. 移植原drpy2的request、post、fetch、reqCookie、getCode、checkHtml、verifyCode等方法并改为异步
9. 增加原drpy2的同步函数 setItem、getItem、clearItem
10. 增加_lib.request.js依赖库，实现了 `requestHtml`和`requestJson`简单封装
11. 在常用一级、二级、搜索等函数里的this里增加jsp、pd、pdfa、pdfh确保指向的链接为当前this的MY_URL
12. 修复pd系列函数取不到属性的问题。新增xvideos源,重写黑料里不正确的pd用法,修复黑料的搜索

```javascript
var rule = {
    hostJs: async function () {
        let {HOST} = this;
        log('HOST:', HOST);
        return 'https://www.baidu.com';
    }
}
```

### 20241206

更新至V1.0.3

1. 完善图片代理相关函数与功能
2. 增加加密源的数据解析
3. crypto-js-wasm.js兼容海阔调用CryptoJSW对象
4. 更新金牌影视，本地代理修复播放问题
5. 暴露更多函数给drpyS源使用。如gzip、ungzip等等
6. 增加源加密功能
7. 根目录增加.nomedia规避手机相册识别ts文件为媒体图片问题
8. 修复金牌影视代理播放不支持海阔引擎的问题
9. 增加会员解密功能
10. 修复pupWebview没引入成功的问题
11. 修正加解密工具不适配移动端高度问题

### 20241205

更新至V1.0.2

1. 增加本地代理功能,示例参考_qq.js 用法:在源的各个js函数里(http://192.168.31.49:5757/api/_qq)

```javascript
let {getProxyUrl} = this;
let vod_url = getProxyUrl() + '&url=' + 'https://hls09.cntv.myhwcdn.cn/asp/hls/2000/0303000a/3/default/d9b0eaa065934f25abd193d391f731b6/2000.m3u8';
```

### 20241204

更新至V1.0.1

1. 引入crypto-js-wasm.js和使用文档
2. 增加docs接口可以查看文档md文件的html页面
3. 完成index.js接口剥离，保持主文件的干净。同时导出start和stop方法
4. 改进本地配置接口，增加外网可用配置。
5. 支持puppeteer,仅pc可用。如需使用请手动安装puppeteer库，然后drpyS的源里支持使用puppeteerHelper对象。
6. 添加favicon.ico
7. 引入全局CryptoJSW对象(海阔暂时会报错无法使用)
8. 增加本地代理功能，示例(跳转百度):

```javascript
var rule = {
    proxy_rule: async function (params) {
        // log(this);
        let {input, MY_URL} = this;
        log(`params:`, params);
        log(`input:${input}`);
        log(`MY_URL::${MY_URL}`);
        // return [404, 'text/plain', 'Not Found']
        return [302, 'text/html', '', {location: 'http://www.baidu.com'}]
    }
}
```

### 20241203

1. 新增misc工具类
2. 新增utils工具类
3. 更新atob、btoa函数逻辑
4. 导出pq函数
5. 增加模块系统,$.require和$.exports
6. 修复drpyS源筛选不生效问题
7. 增加局域网可访问接口
8. 打印所有req发出的请求
9. 增加主页的html
10. 番茄小说示例源增加导入模块的用法
11. 更新自动生成配置的接口，自动读取js目录下非_开头的文件视为源
12. 修正金牌影院js
