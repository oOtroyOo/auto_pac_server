import BaseController from './BaseController.js'
import Koa from 'koa';
import fetch from 'node-fetch';

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
                        let response = await fetch(url + "/api/v1/passport/auth/login", {
                            method: 'POST',
                            body: formData
                        });
                        let result = await response.json();

                        let getSubscribe = await fetch(url + "/api/v1/user/getSubscribe", {
                            headers: { "Authorization": result.data.auth_data }
                        });
                        let resultGetSubscribe = await getSubscribe.json();
                        console.log(url);
                        resolve(resultGetSubscribe)
                    } catch (error) {
                        console.log(`reject ${url} ${error} `);

                        reject(error)
                    }
                })
            );



            let loginJson = await Promise.any(fetchPromises).then(resp => resp);

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
                        let response = await fetch(geturl);
                        let result = await response.text();
                        console.log(geturl);
                        resolve({ result: result, header: response.headers });
                    } catch (error) {
                        console.log(`reject ${geturl} ${error} `);

                        reject(error)
                    }
                })
            );
            let { result, header } = await Promise.any(subscribePromises).then(resp => resp);

            if (result) {
                ctx.status = 200;
                for (const [key, value] of header.entries()) {
                    if (key.toLowerCase() == "Report-To".toLowerCase() ||
                        key.toLowerCase() == "NEL".toLowerCase() ||
                        key.toLowerCase() == "Report-To".toLowerCase() ||
                        key.toLowerCase() == "CF-RAY".toLowerCase() ||
                        key.toLowerCase() == "cf-cache-status".toLowerCase() ||
                        key.toLowerCase() == "server-timing".toLowerCase()
                    ) {
                        ctx.set(key, value);
                    }
                }
                ctx.body = result;
                return
            } else {
                ctx.status = 502;
                ctx.body = { success: false, error: 'All requests failed' };
            }
        } catch (err) {
            ctx.status = 502;
            ctx.body = { success: false, error: err };
            return;
        } finally {
            await super.request(ctx, next)
        }
    }
}