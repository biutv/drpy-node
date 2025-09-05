import {ENV} from '../utils/env.js';
import {keysToLowerCase} from '../utils/utils.js';
import createAxiosInstance from "../utils/createAxiosAgent.js";

const maxSockets = 64;
const _axios = createAxiosInstance({maxSockets: maxSockets});

export default (fastify, options, done) => {
    // 读取 views 目录下的 encoder.html 文件并返回
    fastify.post('/http', async (req, reply) => {
        const {url, headers: userHeaders = {}, params = {}, method = 'GET', data = {}} = req.body;
        if (!url) {
            return reply.status(400).send({error: 'Missing required field: url'});
        }
        const headers = keysToLowerCase({
            ...userHeaders,
        });
        // 添加accept属性防止获取网页源码编码不正确问题
        if (!Object.keys(headers).includes('accept')) {
            headers['accept'] = '*/*';
        }
        console.log(`[httpController] url: ${url} | method: ${method} | params: ${JSON.stringify(params)} | data: ${JSON.stringify(data)} | headers: ${JSON.stringify(headers)}`);
        try {
            const response = await _axios({
                url,
                method,
                headers,
                params,
                data,
            });

            reply.status(response.status).send({
                status: response.status,
                headers: response.headers,
                data: response.data,
            });
        } catch (error) {
            // console.error(error);
            if (error.response) {
                // 服务器返回了非 2xx 状态码
                reply.status(error.response.status).send({
                    error: error.response.data,
                    status: error.response.status,
                });
            } else {
                // 请求失败或其他错误
                reply.status(500).send({error: error.message});
            }
        }
    });

    fastify.get('/ai', async (request, reply) => {
        const userInput = request.query.text;

        if (!userInput || userInput.trim() === '') {
            return reply.status(400).send({error: '请提供文本内容'});
        }

        const postFields = {
            messages: [
                {role: 'user', content: userInput}
            ],
            model: 'gpt-4o-mini-2024-07-18'
        };
        // console.log(JSON.stringify(postFields));
        try {
            const response = await _axios.post(
                'https://api.s01s.cn/API/ai_zdy/?type=2',
                postFields,
                {
                    headers: {'Content-Type': 'application/json'},
                    timeout: 30000,
                }
            );

            return reply.send(response.data);
        } catch (error) {
            fastify.log.error('Error:', error.message);
            return reply.status(500).send({error: '请求失败，请稍后重试'});
        }
    });

    fastify.all('/req/*', async (request, reply) => {
        // 非VERCEL环境可在设置中心控制此功能是否开启
        if (!process.env.VERCEL) {
            if (ENV.get('allow_forward') !== '1') {
                return reply.code(403).send({error: 'Forward api is not allowed by owner'});
            }
        }
        try {
            const targetUrl = request.params['*'];
            if (!/^https?:\/\//.test(targetUrl)) {
                return reply.code(400).send({error: 'Invalid URL. Must start with http:// or https://'});
            }
            console.log(`Forwarding request to: ${targetUrl}`);
            const headers = keysToLowerCase({
                ...request.headers,
            });
            delete headers['host'];
            // 添加accept属性防止获取网页源码编码不正确问题
            if (!Object.keys(headers).includes('accept')) {
                headers['accept'] = '*/*';
            }
            const response = await _axios({
                method: request.method,
                url: targetUrl,
                headers: headers,
                data: request.body,
                params: request.query,
                timeout: 10000,
            });

            reply
                .code(response.status)
                .headers(response.headers)
                .send(response.data);
        } catch (error) {
            console.error('Error forwarding request:', error.message);
            if (error.response) {
                reply
                    .code(error.response.status)
                    .headers(error.response.headers)
                    .send(error.response.data);
            } else {
                reply.code(500).send({error: `Internal Server Error:${error.message}`});
            }
        }
    });

    done();
};
