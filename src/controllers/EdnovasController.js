import BaseController from './BaseController.js'
import Koa from 'koa';
import axios from 'axios';

// http://127.0.0.1:8880/ednovas?email={{email}}&password={{password}}
export default class EdnovasController extends BaseController {
    urls = [
        "https://new.ednovas.org",
        "https://new.ednovas.dev",
        "https://ednovas.tech",
        "https://ednovas.world",
        "https://ednovas.dev",
        "https://cdn.ednovas.tech",
        "https://cdn.ednovas.world",
        "https://cdn.ednovas.org",
    ]

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        const { email, password } = ctx.request.query || {};

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);

            let any = false

            const fetchPromises = this.urls.map(url =>
                new Promise(async (resolve, reject) => {
                    try {
                        let response = await axios.postForm(url + "/api/v1/passport/auth/login", formData, {
                            timeout: 2000
                        });
                        let result = response.data;

                        let getSubscribe = await axios.get(url + "/api/v1/user/getSubscribe", {
                            headers: { "Authorization": result.data.auth_data },
                            timeout: 2000
                        });
                        let resultGetSubscribe = getSubscribe.data;
                        console.log(url);
                        resolve(resultGetSubscribe)
                    } catch (error) {
                        console.log(`reject ${url} ${error} `);

                        reject(error)
                    }
                })
            );



            let loginJson = await this.waitAnySuccess(fetchPromises);

            if (!loginJson) {
                ctx.status = 400
                return
            }
            let subscribeUrls = this.urls.map(url =>
                url + "/api/v1/client/subscribe?token=" + loginJson.data.token
            );

            if (!subscribeUrls.includes(loginJson.data.subscribe_url)) {
                subscribeUrls.push(loginJson.data.subscribe_url)
            }
            const subscribePromises = subscribeUrls.map(geturl =>
                new Promise(async (resolve, reject) => {
                    try {
                        let response = await axios.get(geturl, {
                            timeout: 2000
                        });
                        let result = response.data;
                        console.log(geturl);
                        resolve({ result: result, header: response.headers });
                    } catch (error) {
                        console.log(`reject ${geturl} ${error} `);

                        reject(error)
                    }
                })
            );
            let { result, header } = await this.waitAnySuccess(subscribePromises);

            if (result) {
                ctx.status = 200;
                const keys = [
                    "Report-To".toLowerCase(),
                    "NEL".toLowerCase(),
                    "CF-RAY".toLowerCase(),
                    "cf-cache-status".toLowerCase(),
                    "server-timing".toLowerCase()]
                for (const [key, value] of header) {
                    if (keys.includes(key.toLowerCase())) {
                        ctx.set(key, value);
                    }
                }
                ctx.body = result;
                return
            } else {
                ctx.status = 502;
                ctx.body = { staus: false, error: 'All requests failed' };
            }
        } catch (err) {
            ctx.status = 502;
            ctx.body = { staus: false, error: err };
            return;
        } finally {
            await super.request(ctx, next)
        }
    }

    async waitAnySuccess(fetchPromise) {
        // 创建一个 Set 跟踪未完成的 Promise
        const pending = new Set(fetchPromise);

        while (pending.size > 0) {
            try {
                // Promise.any 会在有任意成功的 Promise 时 resolve，否则等到全部都 rejected 才抛出 AggregateError
                const result = await Promise.any([...pending]);
                return result; // 任意成功立即返回
            } catch (e) {
                // 捕获到 AggregateError，说明目前 pending 里的 Promise 全部 rejected
                // 需要检查这些 Promise 是否都已经 settled（fulfilled 或 rejected）
                const results = await Promise.allSettled([...pending]);
                // 移除已经 settled 的 Promise
                for (let i = 0; i < results.length; i++) {
                    if (results[i].status !== 'pending') {
                        pending.delete([...pending][i]);
                    }
                }
                // 如果全部 settled，说明所有都失败了
                if (pending.size === 0) {
                    return null;
                }
                // 否则循环继续，直到有成功或都 settled
            }
        }
        return null; // 防止极端情况
    }
}