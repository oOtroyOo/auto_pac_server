import Koa from 'koa';
import koaRouter from 'koa-router';

import {
    setTimeout,
    setImmediate,
    setInterval,

} from 'timers/promises'; // 默认常用计时方法替换成Async方法

export default class BaseController {
    /** @type {Koa} */
    app = undefined


    /** @type {koaRouter} */
    router = undefined

    /**
    @param {Koa} app 
    @param {koaRouter} router 
    */
    constructor(app, router) {
        this.app = app
        this.router = router
        this.init()
    }

    init() {
        const name = this.constructor.name.replace('Controller', '').toLowerCase();
        this.router.all('/' + name, async (ctx, next) => {
            try {
                await this.request(ctx, next)
            } catch (e) {
                ctx.status = 500
                ctx.body = `${e.message}\n${e.stack}\n`
                console.error(`\n${e.stack.replace(/^/gm, '  ')}\n`);
            }
        })
    }

    /**
    @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
    @param {Koa.Next} next 
    */
    async request(ctx, next) {
        await next();
    }
}