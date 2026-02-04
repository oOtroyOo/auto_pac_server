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
import { randomInt } from 'crypto';

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

    bookmarks = {}

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
      * localhost:8880/pixiv/ranking?mode=week_r18
      */
    async ranking(ctx) {

        const result = await this.pixivApi.illustRanking({ mode: ctx.request.query.mode, offset: ctx.request.query.offset })
        ctx.body = result
    }
    /**
      * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
      * localhost:8880/pixiv/bookmark?r18=2&type=ugoira
      */
    async bookmark(ctx) {

        var r18 = ctx.request.query.r18
        var type = ctx.request.query.type //   ugoira

        ctx.body = await this.getBookmark(r18, type);
    }

    async getBookmark(r18, type, getLength = 30) {
        const auth = this.pixivApi.auth
        const userId = auth["user"]["id"]
        r18 = parseInt(r18 ?? 0)

        const cacheKey = `${type}+${r18}`
        if (cacheKey in this.bookmarks) {
            return this.bookmarks[cacheKey]
        }
        console.log(`请求收藏 r18=${r18} type=${type}`)

        const result = await this.pixivApi.userBookmarksIllust(userId)
        if (result.illusts) {
            result.illusts = this.filterIllusts(result.illusts, r18, type);

            console.log("筛选结果 " + result.illusts.length)
        }
        let result1 = result
        let page = 1
        while (result.illusts.length < getLength && result1.next_url && page < 5) {
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
        this.bookmarks[cacheKey] = result
        return result
    }

    filterIllusts(illusts, r18, type) {
        r18 = parseInt(r18 ?? 0)
        return illusts.filter(illust => {
            return (illust.x_restrict === r18 || r18 == 2) && (type == undefined || illust.type === type)
        })
    }


    /**
    * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
    * localhost:8880/pixiv/random?r18=0&type=illust&quality=large
    */
    async random(ctx) {
        const r18 = ctx.request.query.r18
        const type = ctx.request.query.type //   ugoira
        const quality = ctx.request.query.quality ?? 'medium'
        const result = await this.getBookmark(r18, type);

        const keys = Object.keys(result.illusts).map(Number);
        for (let i = keys.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [keys[i], keys[j]] = [keys[j], keys[i]];
        }

        let detail = undefined
        while (keys.length > 0) {
            const illust = result.illusts[keys.shift()]
            try {
                detail = await this.pixivApi.illustDetail(illust.id)
                break
            } catch (error) {
                console.log(illust.id)
                console.log(error)
                continue
            }
        }

        if (detail) {
            console.log(detail.illust.id)
            let uri = undefined
            if (detail.illust.meta_pages.length > 0) {
                const page = detail.illust.meta_pages[randomInt(detail.illust.meta_pages.length)]
                uri = new URL(page.image_urls[quality])
            } else {
                uri = new URL(detail.illust.image_urls[quality])
            }
            if (uri) {
                uri.host = 'i.pixiv.ddns-ip.net'
                ctx.redirect(uri.toString())
                return
            }
        }

    }
}