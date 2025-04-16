import BaseController from './BaseController.js'
import Koa from 'koa';

export default class EchoController extends BaseController {

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        var request = ctx.request;
        var content = "Hello !!! ";
        if (request.url.indexOf('?') > 0) {
            content += request.url.substring(request.url.indexOf('?') + 1);
        }
        if (request.body) {
            if (typeof (request.body) == "string") {
                content += request.body;
            } else if (Object.keys(request.body).length > 0) {
                content += JSON.stringify(request.body);
            }
        }
        console.log(content);
        ctx.status = 200;
        ctx.type = "text/plain";
        ctx.body = content;
        await super.request(ctx, next)
    }
}