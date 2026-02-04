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
import { URL } from 'url';

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
                await PixivFunc.loginByToken(process.env["PIXIV_TOKEN"])
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
            if (this.pixivApi.auth.user) {
                const auth = this.pixivApi.auth
                console.log(`Hello Pixiv ${auth["user"]["name"]}:${auth["user"]["account"]}(${auth["user"]["id"]})`)
            }
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

        const result = await this.pixivApi.illustRanking({ mode: ctx.request.query.mode, offset: ctx.request.query.offset })
        ctx.body = result
    }
    /**
      * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
      */
    async bookmark(ctx) {
        const auth = this.pixivApi.auth
        const userId = auth["user"]["id"]
        var r18 = ctx.request.query.r18
        var type = ctx.request.query.type //   ugoira

        console.log(`请求收藏 r18=${r18} type=${type}`)

        const result = await this.pixivApi.userBookmarksIllust(userId)
        if (result.illusts) {
            result.illusts = this.filterIllusts(result.illusts, r18, type);

            console.log("筛选结果 " + result.illusts.length)
        }
        let result1 = result
        let page = 1
        while (result.illusts.length < 30 && result1.next_url && page < 5) {
            page++
            try {
                const nextUrl = new URL(result1.next_url)
                let max_bookmark_id = nextUrl.searchParams.get('max_bookmark_id')
                if (!max_bookmark_id) break

                console.log("请求收藏 lastid " + max_bookmark_id)
                result1 = await this.pixivApi.userBookmarksIllust(userId, {
                    max_bookmark_id: max_bookmark_id
                })
                result1.illusts = this.filterIllusts(result1.illusts, r18, type);
                if (result1.illusts.length > 0) {
                    result.illusts.push(...result1.illusts)
                    console.log("筛选结果 " + result.illusts.length)
                }
            } catch (error) {
                console.log(error)
                break
            }
        }
        ctx.body = result
    }

    filterIllusts(illusts, r18, type) {
        r18 = parseInt(r18 || 0)
        return illusts.filter(illust => {
            return (illust.x_restrict === r18 || r18 == 2) && (type == undefined || illust.type === type)
        })
    }
}