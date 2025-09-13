import {readFileSync, existsSync} from 'fs';
import path from 'path';
import {ENV} from '../utils/env.js';
import COOKIE from '../utils/cookieManager.js';

const COOKIE_AUTH_CODE = process.env.COOKIE_AUTH_CODE || 'drpys';

export default (fastify, options, done) => {
    fastify.get('/admin/encoder', async (request, reply) => {
        const encoderFilePath = path.join(options.appsDir, 'encoder/index.html'); // 获取 encoder.html 文件的路径

        // 检查文件是否存在
        if (!existsSync(encoderFilePath)) {
            return reply.status(404).send({error: 'encoder.html not found'});
        }

        try {
            // 读取 HTML 文件内容
            const htmlContent = readFileSync(encoderFilePath, 'utf-8');
            reply.type('text/html').send(htmlContent); // 返回 HTML 文件内容
        } catch (error) {
            fastify.log.error(`Failed to read encoder.html: ${error.message}`);
            return reply.status(500).send({error: 'Failed to load encoder page'});
        }
    });

    fastify.post('/admin/cookie-set', async (request, reply) => {
        try {
            // 从请求体中获取参数
            const {cookie_auth_code, key, value} = request.body;

            // 验证参数完整性
            if (!cookie_auth_code || !key || !value) {
                return reply.code(400).send({
                    success: false,
                    message: 'Missing required parameters: cookie_auth_code, key, or value',
                });
            }

            // 验证 cookie_auth_code 是否正确
            if (cookie_auth_code !== COOKIE_AUTH_CODE) {
                return reply.code(403).send({
                    success: false,
                    message: 'Invalid cookie_auth_code',
                });
            }

            let cookie_obj = COOKIE.parse(value);
            let cookie_str = value;

            if (['quark_cookie', 'uc_cookie'].includes(key)) {
                // console.log(cookie_obj);
                cookie_str = COOKIE.stringify({
                    __pus: cookie_obj.__pus || '',
                    __puus: cookie_obj.__puus || '',
                });
                console.log(cookie_str);
            }
            // 调用 ENV.set 设置环境变量
            ENV.set(key, cookie_str);

            // 返回成功响应
            return reply.code(200).send({
                success: true,
                message: 'Cookie value has been successfully set',
                data: {key, value},
            });
        } catch (error) {
            // 捕获异常并返回错误响应
            console.error('Error setting cookie:', error.message);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error',
            });
        }
    });

    done();
};
