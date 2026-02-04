import axios from 'axios';
import Koa from 'koa';
import BaseController from './BaseController.js';
import koaRouter from 'koa-router';
import { ProxyAgent } from 'proxy-agent';
import * as child_process from 'child_process'
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises';
import { URL } from 'url';
import { stderr, stdout } from 'process';
import { pipeline } from 'stream/promises'; // 添加 pipeline 用于流转发

// 过滤并设置响应头
const skipHeaders = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
const NeedProxyUrl = [
    /.*\.pixiv\.net$/,
    /.*\.pximg\.net$/
]
const RefererMap = [
    [/.*\.pximg\.net$/, "https://www.pixiv.net/"]
]
const proxyPort = "10809"
export default class ForwardController extends BaseController {



    init() {
        super.init()
        this.axios = axios.create({
            httpsAgent: new ProxyAgent({
                rejectUnauthorized: false,
                getProxyForUrl: (targetUrl) => {

                    const url = new URL(targetUrl)
                    for (const match of NeedProxyUrl) {
                        if (match.test(url.host)) {
                            try {
                                if (process.platform.indexOf("win") >= 0) {
                                    const result = child_process.execSync("cmd /c netstat -ano | findstr 0.0.0.0:10809", {
                                        encoding: 'ascii'
                                    })
                                    if (result.trim().length > 0 && result.indexOf("LISTENING") >= 0)
                                        return `http://localhost:${proxyPort}`;
                                }
                            } catch (error) {
                                console.log(error)
                            }
                            break
                        }
                    }
                    return undefined
                }
            })
        })
        this.router.all(this.router.stack[this.router.stack.length - 1].path + '/*url', async (ctx, next) => await this.request(ctx, next))
    }
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        const url = new URL("https://" + ctx.params.url)

        const headers = ctx.request.headers
        if (!headers['accept-language']) {
            headers['accept-language'] = 'zh-cn'
        }
        headers.host = url.host
        for (var list of RefererMap) {
            if (list[0].test(url.host)) {
                headers.referer = list[1]
                break
            }
        }

        try {
            const response = await this.axios.request({
                method: ctx.request.method.toLowerCase(),
                url: url.toString(),
                data: ctx.request.body,
                params: ctx.request.query,
                headers: headers,
                responseType: 'stream',
                // 添加这些选项确保流正确处理
                decompress: false, // 不解压，原样返回
                validateStatus: () => true // 允许任何状态码，让客户端处理
            });

            ctx.response.status = response.status;


            for (const [key, value] of Object.entries(response.headers)) {
                if (!skipHeaders.includes(key.toLowerCase())) {
                    ctx.response.set(key, value);
                }
            }

            // 使用 pipeline 确保流正确传递和错误处理
            if (response.data) {
                ctx.response.body = response.data;
            }

        } catch (error) {
            console.error('Forward request error:', error.message);
            ctx.response.status = error.response?.status || 500;
            ctx.response.body = { error: error.message };
        }
    }
}
