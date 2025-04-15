import BaseController from './BaseController.js';
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

export default class TestController extends BaseController {
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        console.log("test in");
        await setTimeout(2000);
        ctx.status = 200;
        console.log("test finish");
        await super.request(ctx, next)
        console.log("test out");
    }
}