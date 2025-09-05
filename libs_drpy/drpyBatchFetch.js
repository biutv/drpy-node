import PQueue from 'p-queue';
import Queue from 'queue';
import createAxiosInstance from '../utils/createAxiosAgent.js';

const maxSockets = 16;
const _axios = createAxiosInstance({maxSockets:maxSockets});


export const batchFetch1 = async (items, maxWorkers = 5, timeoutConfig = 5000) => {
    let t1 = (new Date()).getTime();
    const queue = new PQueue({concurrency: maxWorkers});

    // 获取全局 timeout 设置
    const timeout = timeoutConfig;

    // 遍历 items 并生成任务队列
    const promises = items.map((item) => {
        return queue.add(async () => {
            try {
                const response = await _axios(
                    Object.assign({}, item?.options, {
                        url: item.url,
                        method: item?.options?.method || 'GET',
                        timeout: item?.options?.timeout || timeout,
                        responseType: 'text',
                    }),
                );
                return response.data;
            } catch (error) {
                console.log(`[batchFetch][error] ${item.url}: ${error}`);
                return null;
            }
        });
    });
    const results = await Promise.all(promises);
    let t2 = (new Date()).getTime();
    log(`PQueue 批量请求 ${items[0].url} 等 ${items.length}个地址 耗时${t2 - t1}毫秒:`);
    // 执行所有任务
    return results
};

export const batchFetch2 = async (items, maxWorkers = 5, timeoutConfig = 5000) => {
    let t1 = (new Date()).getTime();
    const queue = new Queue({concurrency: maxWorkers, autostart: true});

    // 获取全局 timeout 设置
    const timeout = timeoutConfig;

    const results = [];
    const promises = [];

    items.forEach((item, index) => {
        promises.push(
            new Promise((resolve) => {
                queue.push(async () => {
                    try {
                        const response = await _axios(
                            Object.assign({}, item?.options, {
                                url: item.url,
                                method: item?.options?.method || 'GET',
                                timeout: item?.options?.timeout || timeout,
                                responseType: 'text',
                            }),
                        );
                        results[index] = response.data;
                        resolve();
                    } catch (error) {
                        console.log(`[batchFetch][error] ${item.url}: ${error}`);
                        results[index] = null;
                        resolve();
                    }
                });
            }),
        );
    });

    await Promise.all(promises);
    let t2 = (new Date()).getTime();
    log(`Queue 批量请求 ${items[0].url} 等 ${items.length}个地址 耗时${t2 - t1}毫秒:`);
    return results;
};



