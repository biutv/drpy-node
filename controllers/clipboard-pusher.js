import fs from 'fs/promises';
import path from 'path';
import {validateVercel} from '../utils/api_validate.js';

// 认证中间件（callback 风格，方便跟 validateVercel 一致）
function authenticate(request, reply, done) {
    const SECURITY_CODE = process.env.CLIPBOARD_SECURITY_CODE;
    if (!SECURITY_CODE) return done(); // 不启用安全码

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send('Invalid authorization header format');
    }

    const token = authHeader.substring(7);
    if (token !== SECURITY_CODE) {
        return reply.code(401).send('Invalid security code');
    }

    done();
}

export default async function (fastify, options) {
    const MAX_TEXT_SIZE = parseInt(process.env.CLIPBOARD_MAX_SIZE) || 100 * 1024;
    const SECURITY_CODE = process.env.CLIPBOARD_SECURITY_CODE;
    const ALLOWED_CHARSET = process.env.CLIPBOARD_ALLOWED_CHARSET || 'utf8';
    const MAX_READ_SIZE = parseInt(process.env.CLIPBOARD_MAX_READ_SIZE) || 2 * 1024 * 1024;

    if (!SECURITY_CODE) {
        fastify.log.warn('CLIPBOARD_SECURITY_CODE is not set, API will be unprotected!');
    }

    // ===== 工具函数 =====
    function containsExecutablePatterns(text) {
        const executablePatterns = [
            /\x4D\x5A/, // MZ
            /\x7F\x45\x4C\x46/, // ELF
            /\x23\x21/, // Shebang
            /<\?php/,
            /<script\b[^>]*>/,
            /eval\(/,
            /javascript:/i,
            /vbscript:/i,
        ];
        return executablePatterns.some(pattern => pattern.test(text));
    }

    function isValidCharset(text, allowedCharset) {
        try {
            if (allowedCharset === 'utf8') {
                Buffer.from(text, 'utf8').toString('utf8');
            }
            return true;
        } catch {
            return false;
        }
    }

    // ============ 添加文本接口 ============
    fastify.post('/clipboard/add', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const {text, mode = 'append'} = request.body;

        if (!text || typeof text !== 'string') {
            return reply.code(400).send('Valid text content is required');
        }
        if (!['append', 'overwrite'].includes(mode)) {
            return reply.code(400).send('Mode must be either "append" or "overwrite"');
        }

        const textSize = Buffer.byteLength(text, 'utf8');
        if (textSize > MAX_TEXT_SIZE) {
            return reply.code(413).send(`Text exceeds maximum size of ${MAX_TEXT_SIZE} bytes`);
        }
        if (containsExecutablePatterns(text)) {
            return reply.code(400).send('Content contains suspicious patterns');
        }
        if (!isValidCharset(text, ALLOWED_CHARSET)) {
            return reply.code(400).send('Text contains invalid characters');
        }

        const filePath = path.resolve(process.cwd(), 'clipboard.txt');
        if (!filePath.startsWith(process.cwd())) {
            return reply.code(500).send('Invalid file path');
        }

        try {
            if (mode === 'append') {
                await fs.appendFile(filePath, text + '\n');
            } else {
                // 覆盖模式：先备份
                try {
                    const currentContent = await fs.readFile(filePath, 'utf8');
                    const backupPath = path.resolve(process.cwd(), 'clipboard.txt.bak');
                    if (backupPath.startsWith(process.cwd())) {
                        await fs.writeFile(backupPath, currentContent);
                        fastify.log.info(`Clipboard content backed up to ${backupPath}`);
                    }
                } catch {
                    fastify.log.info('No existing clipboard file to backup');
                }
                await fs.writeFile(filePath, text + '\n');
            }

            return reply.send({
                success: true,
                message: `Text ${mode === 'append' ? 'appended' : 'written'} successfully`,
                size: textSize,
                mode,
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to process the request');
        }
    });

    // ============ 清空文本接口 ============
    fastify.post('/clipboard/clear', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const filePath = path.resolve(process.cwd(), 'clipboard.txt');
        const backupPath = path.resolve(process.cwd(), 'clipboard.txt.bak');

        if (!filePath.startsWith(process.cwd()) || !backupPath.startsWith(process.cwd())) {
            return reply.code(500).send('Invalid file path');
        }

        try {
            await fs.access(filePath);
        } catch {
            return reply.send({
                success: true,
                message: 'Clipboard already empty, no backup created',
            });
        }

        try {
            const currentContent = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, currentContent);
            fastify.log.info(`Clipboard content backed up to ${backupPath}`);

            await fs.writeFile(filePath, '');
            return reply.send({
                success: true,
                message: 'Clipboard cleared successfully, backup created',
                backupSize: Buffer.byteLength(currentContent, 'utf8'),
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to clear clipboard');
        }
    });

    // ============ 读取文本接口 ============
    fastify.get('/clipboard/read', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const filePath = path.resolve(process.cwd(), 'clipboard.txt');
        if (!filePath.startsWith(process.cwd())) {
            return reply.code(500).send('Invalid file path');
        }

        try {
            await fs.access(filePath).catch(() => null);

            const stats = await fs.stat(filePath).catch(() => ({size: 0}));
            if (stats.size === 0) {
                return reply.type('text/plain;charset=utf-8').send('');
            }
            if (stats.size > MAX_READ_SIZE) {
                return reply.code(413).send(`File size exceeds maximum read size of ${MAX_READ_SIZE} bytes`);
            }

            const content = await fs.readFile(filePath, 'utf8');
            return reply.type('text/plain;charset=utf-8').send(content);
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to read clipboard content');
        }
    });
}
