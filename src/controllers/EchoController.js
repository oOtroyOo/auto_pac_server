import BaseController from './BaseController.js'

export default class EchoController extends BaseController {

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        ctx.body = { message: 'Echo response' };
        await super.request(ctx, next);
    }
}