import DsQueue from './dsQueue.js';
import fastq from "fastq";
import createAxiosInstance from "../utils/createAxiosAgent.js";

const maxSockets = 16;
const _axios = createAxiosInstance({maxSockets: maxSockets});

async function sleep(ms) {
    // 模拟异步请求
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export const batchFetch3 = async (items, maxWorkers = 16, timeoutConfig = 5000, batchSize = 16) => {
    let t1 = (new Date()).getTime();

    // 获取全局 timeout 设置
    const timeout = timeoutConfig;

    // 创建任务处理函数
    const worker = async (task, callback) => {
        const {item, index, results} = task;
        try {
            const response = await _axios(
                Object.assign({}, item?.options, {
                    url: item.url,
                    method: item?.options?.method || 'GET',
                    timeout: item?.options?.timeout || timeout,
                    responseType: 'text',
                }),
            );
            results[index] = response.data; // 保存结果
            callback(null); // 通知任务成功完成
        } catch (error) {
            console.log(`[batchFetch][error] ${item.url}: ${error}`);
            results[index] = null; // 记录错误
            callback(null); // 即使出错，也调用回调，不中断任务队列
        }
    };

    // 创建 fastq 队列
    const results = new Array(items.length).fill(null); // 关键改动：提前初始化 results 数组

    // 分批次处理
    const queue = fastq(worker, maxWorkers); // 关键改动：在整个函数中只创建一个队列

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        const tasks = batch.map((item, index) => {
            return new Promise((resolve) => {
                queue.push({item, index: i + index, results}, resolve);
            });
        });

        // 等待当前批次任务完成
        await Promise.all(tasks);
        // await sleep(200); // 如果需要，可以在这里添加短暂的休眠
    }

    let t2 = (new Date()).getTime();
    console.log(`fastq 批量请求 ${items[0].url} 等 ${items.length}个地址 耗时${t2 - t1}毫秒:`);

    return results;
};

export const batchFetch4 = async (items, maxWorkers = 5, timeoutConfig = 5000) => {
    let t1 = (new Date()).getTime();

    // 获取全局 timeout 设置
    const timeout = timeoutConfig;

    const results = new Array(items.length).fill(null); // 关键改动：提前初始化 results 数组
    const queue = new DsQueue(maxWorkers); // 关键改动：在整个函数中只创建一个队列

    items.forEach((item, index) => {
        queue.add(async () => {
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
            } catch (error) {
                console.log(`[batchFetch][error] ${item.url}: ${error}`);
                results[index] = null;
            }
        });
    });

    await queue.onIdle();
    let t2 = (new Date()).getTime();
    console.log(`DsQueue 批量请求 ${items[0].url} 等 ${items.length}个地址 耗时${t2 - t1}毫秒:`);

    return results;
};
