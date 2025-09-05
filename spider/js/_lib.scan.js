class QRCodeHandler {
    // 状态常量
    static STATUS_NEW = "NEW";            // 待扫描
    static STATUS_SCANED = "SCANED";      // 已扫描
    static STATUS_CONFIRMED = "CONFIRMED"; // 已确认
    static STATUS_CANCELED = "CANCELED";   // 已取消
    static STATUS_EXPIRED = "EXPIRED";     // 已过期

    // 平台常量
    static PLATFORM_QUARK = "quark";      // 夸克
    static PLATFORM_ALI = "ali";          // 阿里云盘
    static PLATFORM_UC = "uc";            // UC
    static PLATFORM_BILI = "bili";        // 哔哩哔哩

    // 通用请求头
    static HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; M2012K10C Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*'
    };

    constructor() {
        this.platformStates = {
            [QRCodeHandler.PLATFORM_QUARK]: null,
            [QRCodeHandler.PLATFORM_ALI]: null,
            [QRCodeHandler.PLATFORM_UC]: null,
            [QRCodeHandler.PLATFORM_BILI]: null
        };
    }
}

const qrcode = new QRCodeHandler();

function formatCookiesToList(cookieString) {
    const result = [];
    let currentCookie = '';
    let inExpires = false;

    for (let i = 0; i < cookieString.length; i++) {
        const char = cookieString[i];

        // 判断是否进入或退出 `expires` 属性
        if (cookieString.slice(i, i + 8).toLowerCase() === 'expires=') {
            inExpires = true;
        }
        if (inExpires && char === ';') {
            inExpires = false;
        }

        // 检测到逗号分隔符并且不在 `expires` 属性中，表示一个 Cookie 条目结束
        if (char === ',' && !inExpires) {
            result.push(currentCookie.trim());
            currentCookie = '';
        } else {
            currentCookie += char;
        }
    }

    // 添加最后一个 Cookie 条目
    if (currentCookie.trim()) {
        result.push(currentCookie.trim());
    }

    return result;
}

function formatCookie(cookies) {
    if (!Array.isArray(cookies)) cookies = [cookies];
    if (cookies.length === 0) return '';

    let mainCookies = [];
    for (const cookie of cookies) {
        if (cookie && typeof cookie === 'string' && cookie.trim()) {
            mainCookies.push(cookie.split('; ')[0]);
        }
    }
    return mainCookies.join(';');
}

async function _checkQuarkStatus(state, httpUrl) {
    try {
        console.log(`[_checkQuarkStatus] httpUrl: ${httpUrl}`);
        const res = await axios({
            url: httpUrl,
            method: "POST",
            data: {
                url: "https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken",
                headers: {
                    ...QRCodeHandler.HEADERS
                },
                params: {
                    request_id: state.request_id,
                    client_id: "532",
                    v: "1.2",
                    token: state.token
                }
            }
        });
        const resData = res.data;

        if (resData.data.status === 2000000) { // 扫码成功
            const serviceTicket = resData.data.data.members.service_ticket;
            const cookieRes = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://pan.quark.cn/account/info",
                    headers: {
                        ...QRCodeHandler.HEADERS
                    },
                    params: {
                        st: serviceTicket,
                        lw: "scan"
                    }
                }
            });
            log('扫码成功,开始获取cookie');
            const cookieResData = cookieRes.data;
            const cookies = Array.isArray(cookieResData.headers['set-cookie']) ? cookieResData.headers['set-cookie'].join('; ') : cookieResData.headers['set-cookie'];
            const cookies2array = formatCookiesToList(cookies);
            let mainCookies = formatCookie(cookies2array);
            const cookieSelfRes = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str=&pdir_fid=0&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc",
                    headers: {
                        ...QRCodeHandler.HEADERS,
                        Origin: 'https://pan.quark.cn',
                        Referer: 'https://pan.quark.cn/',
                        Cookie: mainCookies
                    }
                }
            });
            const cookieResDataSelf = cookieSelfRes.data;
            const cookiesSelf = Array.isArray(cookieResDataSelf.headers['set-cookie']) ? cookieResDataSelf.headers['set-cookie'].join('; ') : cookieResDataSelf.headers['set-cookie'];
            const cookies2arraySelf = formatCookiesToList(cookiesSelf);
            const mainCookiesSelf = formatCookie(cookies2arraySelf);
            if (mainCookiesSelf) mainCookies += ';' + mainCookiesSelf;
            return {
                status: QRCodeHandler.STATUS_CONFIRMED,
                cookie: mainCookies
            };
        } else if (resData.data.status === 50004002) { // token过期
            return {status: 'EXPIRED'};
        } else {
            return {status: 'NEW'};
        }
    } catch (e) {
        console.error(e);
        log(`[_checkQuarkStatus] error:${e.message}`);
        throw new Error(e.response.data.message || e.message);
    }
}

async function _checkUCStatus(state, httpUrl) {
    try {
        const res = await axios({
            url: httpUrl,
            method: "POST",
            data: {
                url: "https://api.open.uc.cn/cas/ajax/getServiceTicketByQrcodeToken",
                method: "POST",
                headers: {
                    ...QRCodeHandler.HEADERS
                },
                params: {
                    __t: Date.now()
                },
                data: {
                    v: "1.2",
                    request_id: state.request_id,
                    client_id: "381",
                    token: state.token
                }
            }
        });
        const resData = res.data;

        if (resData.data.status === 2000000) { // 扫码成功
            const serviceTicket = resData.data.data.members.service_ticket;
            const cookieRes = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://drive.uc.cn/account/info",
                    headers: {
                        ...QRCodeHandler.HEADERS
                    },
                    params: {
                        st: serviceTicket
                    },
                }
            });
            log('扫码成功,开始获取cookie');
            const cookieResData = cookieRes.data;
            const cookies = cookieResData.headers['set-cookie'];
            const cookies2array = formatCookiesToList(cookies);
            let mainCookies = formatCookie(cookies2array);
            const cookieSelfRes = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://pc-api.uc.cn/1/clouddrive/config?pr=UCBrowser&fr=pc",
                    headers: {
                        ...QRCodeHandler.HEADERS,
                        Origin: 'https://drive.uc.cn',
                        Referer: 'https://drive.uc.cn/',
                        Cookie: mainCookies
                    }
                }
            });
            const cookieResDataSelf = cookieSelfRes.data;
            const cookiesSelf = Array.isArray(cookieResDataSelf.headers['set-cookie']) ? cookieResDataSelf.headers['set-cookie'].join('; ') : cookieResDataSelf.headers['set-cookie'];
            const cookies2arraySelf = formatCookiesToList(cookiesSelf);
            const mainCookiesSelf = formatCookie(cookies2arraySelf);
            if (mainCookiesSelf) mainCookies += ';' + mainCookiesSelf;
            return {
                status: QRCodeHandler.STATUS_CONFIRMED,
                cookie: mainCookies
            };
        } else if (resData.data.status === 50004002) { // token过期
            return {status: 'EXPIRED'};
        } else {
            return {status: 'NEW'};
        }
    } catch (e) {
        console.error(e);
        log(`[_checkUCStatus] error:${e.message}`);
        throw new Error(e.response.data.message || e.message);
    }
}

async function _checkAliStatus(state, httpUrl) {
    try {
        const res = await axios({
            url: httpUrl,
            method: "POST",
            data: {
                url: "https://passport.aliyundrive.com/newlogin/qrcode/query.do",
                method: "POST",
                headers: {
                    ...QRCodeHandler.HEADERS
                },
                params: {
                    appName: "aliyun_drive",
                    fromSite: "52",
                    _bx_v: "2.2.3"
                },
                data: {
                    ck: state.ck,
                    t: state.t,
                    appName: "aliyun_drive",
                    appEntrance: "web",
                    isMobile: "false",
                    lang: "zh_CN",
                    returnUrl: "",
                    navlanguage: "zh-CN",
                    bizParams: ""
                }
            }
        });
        const resData = res.data;

        if (!resData.data.content || !resData.data.content.data) {
            return {status: QRCodeHandler.STATUS_EXPIRED};
        }

        const status = resData.data.content.data.qrCodeStatus;

        if (status === "CONFIRMED") {
            if (resData.data.content.data.bizExt) {
                const bizExt = JSON.parse(atob(resData.data.content.data.bizExt));
                console.log('[_lib.scan.js]阿里扫码结果:', bizExt.pds_login_result);
                return {
                    status: QRCodeHandler.STATUS_CONFIRMED,
                    token: bizExt.pds_login_result.refreshToken
                };
            }
            return {status: QRCodeHandler.STATUS_EXPIRED};
        } else if (status === "SCANED") {
            return {status: QRCodeHandler.STATUS_SCANED};
        } else if (status === "CANCELED") {
            this.platformStates[QRCodeHandler.PLATFORM_ALI] = null;
            return {status: QRCodeHandler.STATUS_CANCELED};
        } else if (status === "NEW") {
            return {status: QRCodeHandler.STATUS_NEW};
        } else {
            return {status: QRCodeHandler.STATUS_EXPIRED};
        }
    } catch (e) {
        console.error(e);
        log(`[_checkAliStatus] error:${e.message}`);
        throw new Error(e.response.data.message || e.message);
    }
}

async function _checkBiliStatus(state, httpUrl) {
    try {
        const res = await axios({
            url: httpUrl,
            method: "POST",
            data: {
                url: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
                headers: {
                    ...QRCodeHandler.HEADERS
                },
                params: {
                    qrcode_key: state.qrcode_key,
                    source: "main-mini"
                }
            }
        });
        const resData = res.data;

        if (resData.data.code !== 0) {
            throw new Error(resData.data.message);
        }

        if (resData.data.data.code === 86101) { // 未扫码
            return {status: QRCodeHandler.STATUS_NEW};
        } else if (resData.data.data.code === 86090) { // 已扫码未确认
            return {status: QRCodeHandler.STATUS_SCANED};
        } else if (resData.data.data.code === 0) { // 已确认
            const url = resData.data.data.url;
            let cookie = "";
            if (url) {
                const search = new URL(url).search;
                cookie = search.slice(1);
                cookie = decodeURIComponent(cookie);
            }
            return {
                status: QRCodeHandler.STATUS_CONFIRMED,
                cookie: cookie
            };
        } else { // 二维码过期
            this.platformStates[QRCodeHandler.PLATFORM_BILI] = null;
            return {status: QRCodeHandler.STATUS_EXPIRED};
        }
    } catch (e) {
        console.error(e);
        log(`[_checkBiliStatus] error:${e.message}`);
        throw new Error(e.response.data.message || e.message);
    }
}

$.exports = {
    QRCodeHandler,
    qrcode,
    formatCookiesToList,
    formatCookie,
    _checkQuarkStatus,
    _checkUCStatus,
    _checkAliStatus,
    _checkBiliStatus,
}
