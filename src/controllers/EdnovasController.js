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


        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        let any = false
        try {
            const fetchPromises = this.urls.map(url =>
                new Promise(async (resolve, reject) => {
                    try {
                        console.log(url + "/api/v1/passport/auth/login");
                        let response = await fetch(url + "/api/v1/passport/auth/login", {
                            method: 'POST',
                            body: formData
                        });
                        let result = await response.json();
                        resolve(result)
                    } catch (error) {
                        console.log(`reject ${url} ${error} `);

                        reject(error)
                    }
                })
            );


            let loginJson = await Promise.any(fetchPromises);

            const subscribePromises = this.urls.map(url =>
                new Promise(async (resolve, reject) => {
                    try {
                        const geturl = url + "/api/v1/client/subscribe?token=" + loginJson.data.token
                        console.log(geturl);
                        let response = await fetch(geturl);
                        let result = await response.text();
                        resolve(result)
                    } catch (error) {
                        console.log(`reject ${url} ${error} `);

                        reject(error)
                    }
                })
            );

            let subscribe = await Promise.any(subscribePromises);
            ctx.body = subscribe;
        } catch (err) {
            ctx.status = 502;
            ctx.body = { success: false, error: 'All requests failed' };
            return;
        }
        await super.request(ctx, next)
    }
}