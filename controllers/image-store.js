import {imageManager} from '../utils/imageManager.js'
import {validateBasicAuth} from '../utils/api_validate.js'

// Fastify插件导出
export default (fastify, options, done) => {
    fastify.post('/image/upload', {
        preHandler: validateBasicAuth,
        schema: {
            body: {
                type: 'object',
                required: ['imageId', 'base64Data'],
                properties: {
                    imageId: {type: 'string', minLength: 1, maxLength: 100},
                    base64Data: {type: 'string', minLength: 1}
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId, base64Data} = request.body;

            // 检查图片大小限制 (默认500KB)
            const maxSize = options.MAX_IMAGE_SIZE || 0.5 * 1024 * 1024;
            const imageSize = Buffer.byteLength(base64Data, 'utf8');

            if (imageSize > maxSize) {
                return reply.status(400).send({
                    success: false,
                    message: `图片大小超过限制 (${(maxSize / 1024 / 1024).toFixed(1)}MB)`
                });
            }

            // 可以不检查，避免很多图片导致的浪费
            // 检查是否已存在
            // if (imageManager.getImage(imageId)) {
            //     return reply.status(409).send({
            //         success: false,
            //         message: '图片ID已存在，请使用不同的ID或先删除现有图片'
            //     });
            // }

            const result = imageManager.storeImage(imageId, base64Data);

            reply.send({
                success: true,
                message: '图片上传成功',
                data: result
            });

        } catch (error) {
            reply.status(400).send({
                success: false,
                message: error.message
            });
        }
    });

    // 获取图片 - GET /image/:imageId
    fastify.get('/image/:imageId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'}
                },
                required: ['imageId']
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;
            const imageInfo = imageManager.getImage(imageId);

            if (!imageInfo) {
                return reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

            // 解析base64数据
            const {mimeType, buffer} = imageManager.parseBase64ToBuffer(imageInfo.data);

            // 设置响应头
            reply.header('Content-Type', `image/${mimeType}`);
            reply.header('Content-Length', buffer.length);
            reply.header('Cache-Control', 'public, max-age=3600'); // 缓存1小时
            reply.header('Last-Modified', new Date(imageInfo.timestamp).toUTCString());

            // 返回图片数据
            reply.send(buffer);

        } catch (error) {
            reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    // 获取图片列表 - GET /image/list
    fastify.get('/image/list', async (request, reply) => {
        try {
            const images = imageManager.getAllImages();

            reply.send({
                success: true,
                data: {
                    images: images,
                    total: images.length
                }
            });

        } catch (error) {
            reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    // 删除图片 - DELETE /image/:imageId
    fastify.delete('/image/:imageId', {
        preHandler: validateBasicAuth,
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'}
                },
                required: ['imageId']
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;

            if (imageManager.deleteImage(imageId)) {
                reply.send({
                    success: true,
                    message: '图片删除成功'
                });
            } else {
                reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

        } catch (error) {
            reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    // 获取内存使用情况 - GET /image/memory
    fastify.get('/image/memory', async (request, reply) => {
        try {
            const usage = imageManager.getMemoryUsage();

            reply.send({
                success: true,
                data: usage
            });

        } catch (error) {
            reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    // 清理过期图片 - POST /image/cleanup
    fastify.post('/image/cleanup', {
        preHandler: validateBasicAuth,
        schema: {
            body: {
                type: 'object',
                properties: {
                    maxAge: {type: 'number', minimum: 1000} // 最小1秒
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {maxAge} = request.body || {};
            const cleanedCount = imageManager.cleanExpiredImages(maxAge);

            reply.send({
                success: true,
                message: `清理完成，删除了 ${cleanedCount} 张过期图片`,
                data: {
                    cleanedCount: cleanedCount,
                    remainingCount: imageManager.getMemoryUsage().imageCount
                }
            });

        } catch (error) {
            reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    // 更新图片 - PUT /image/:imageId
    fastify.put('/image/:imageId', {
        preHandler: validateBasicAuth,
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'}
                },
                required: ['imageId']
            },
            body: {
                type: 'object',
                required: ['base64Data'],
                properties: {
                    base64Data: {type: 'string', minLength: 1}
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;
            const {base64Data} = request.body;

            // 检查图片是否存在
            if (!imageManager.getImage(imageId)) {
                return reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

            // 检查图片大小限制
            const maxSize = options.MAX_IMAGE_SIZE || 0.5 * 1024 * 1024;
            const imageSize = Buffer.byteLength(base64Data, 'utf8');

            if (imageSize > maxSize) {
                return reply.status(400).send({
                    success: false,
                    message: `图片大小超过限制 (${(maxSize / 1024 / 1024).toFixed(1)}MB)`
                });
            }

            const result = imageManager.storeImage(imageId, base64Data);

            reply.send({
                success: true,
                message: '图片更新成功',
                data: result
            });

        } catch (error) {
            reply.status(400).send({
                success: false,
                message: error.message
            });
        }
    });

    done();
};