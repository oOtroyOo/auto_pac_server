import BaseController from './BaseController.js';
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

export default class ErrorController extends BaseController {
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        throw new Error("This is ERROR") // This will throw an error
        await super.request(ctx, next)
    }
}