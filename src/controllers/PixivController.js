import Koa from 'koa';
import BaseController from './BaseController.js';
import koaRouter from 'koa-router';
import PixivFunc from '../../node_modules/pxder/src/index.js'
import PixivApi from '../../node_modules/pxder/src/pixiv-api-client-mod.js'
import {
    setTimeout,
    setImmediate,
    setInterval,

} from 'timers/promises'; // 默认常用计时方法替换成Async方法
import { type } from 'os';

const _Modes = [
    "day",
    "week",
    "month",
    "day_male",
    "day_female",
    "week_original",
    "week_rookie",
    "day_manga",
    "day_r18",
    "day_male_r18",
    "day_female_r18",
    "week_r18",
    "week_r18g"
]
export default class PixivController extends BaseController {

    config = PixivFunc.readConfig()
    pixivFunc = new PixivFunc()
    /** @type {PixivApi} */
    pixivApi = undefined

    init() {
        this.config = PixivFunc.readConfig()
        this.pixivFunc = new PixivFunc()

        PixivFunc.applyProxyConfig()
        super.init()
        this.router.all(this.router.stack[this.router.stack.length - 1].path + '/:action', async (ctx, next) => await this.request(ctx, next))
    }
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        if (!this.pixivApi) {
            if (process.env["PIXIV_TOKEN"]) {
                console.log("Pixiv 环境Token " + process.env["PIXIV_TOKEN"])
                PixivFunc.loginByToken(process.env["PIXIV_TOKEN"])
            }
            if (await this.pixivFunc.relogin()) {
                this.config = PixivFunc.readConfig()
                console.log("Pixiv 配置Token " + this.config.refresh_token)
            } else {

            }
            if (this.pixivFunc.pixiv == null) {
                console.log("Pixiv 登录失败")
                ctx.response.status = 400
                return
            }
            this.pixivApi = this.pixivFunc.pixiv
            this.pixivApi.setLanguage("zh-cn")
        }
        if (ctx.params.action && this[ctx.params.action]) {
            await this[ctx.params.action](ctx)
        } else {
            ctx.response.status = 204
        }

        await super.request(ctx, next);
    }

    /**
      * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
      */
    async ranking(ctx) {

        const result = await this.pixivApi.illustRanking({ mode: ctx.request.query.mode })
        ctx.body = result
    }

    async bookmark(ctx) {

    }
}