import Koa from 'koa';
import koaRouter from 'koa-router';

import {
    setTimeout,
    setImmediate,
    setInterval,

} from 'timers/promises'; // 默认常用计时方法替换成Async方法

export default class BaseController {
    /**
    @param {Koa} app 
    @param {koaRouter} router 
    */
    constructor(app, router) {
        const name = this.constructor.name.replace('Controller', '').toLowerCase();
        router.all('/' + name, async (ctx, next) => {
            await this.request(ctx, next)
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