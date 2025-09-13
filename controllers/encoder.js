import {jsEncoder} from '../libs_drpy/drpyCustom.js';
import {readFileSync, writeFileSync} from 'fs';

// 检测命令行参数
const args = process.argv.slice(2);

if (args.length > 0) {
    // 如果有参数，读取文件并打印内容
    const filePath = args[0]; // 第一个参数作为文件路径
    let content = readFileSync(filePath, 'utf8');
    console.log(`文件 ${filePath} 的内容长度为:${content.length}`);
    writeFileSync(filePath + '.gz', jsEncoder.gzip(content), 'utf-8');
}

// 仅仅支持json post 如: {"type":"gzip","code":"xxx"}
export default (fastify, options, done) => {
    // 注册 POST 路由
    fastify.post('/encoder', async (request, reply) => {
        const {code, type} = request.body;

        if (!code || !type) {
            return reply.status(400).send({error: 'Missing required parameters: code and type'});
        }

        // 检查文本大小
        const textSize = Buffer.byteLength(code, 'utf8'); // 获取 UTF-8 编码的字节大小
        if (textSize > options.MAX_TEXT_SIZE) {
            return reply
                .status(400)
                .send({error: `Text content exceeds the maximum size of ${options.MAX_TEXT_SIZE / 1024} KB`});
        }

        try {
            let result;

            switch (type) {
                case 'base64':
                    result = jsEncoder.base64Encode(code);
                    break;
                case 'gzip':
                    result = jsEncoder.gzip(code);
                    break;
                case 'aes':
                    result = jsEncoder.aes_encrypt(code);
                    break;
                case 'rsa':
                    result = jsEncoder.rsa_encode(code);
                    break;
                default:
                    throw new Error(`Unsupported type: ${type}`);
            }

            reply.send({success: true, result});
        } catch (error) {
            reply.status(500).send({error: error.message});
        }
    });
    done();
};
