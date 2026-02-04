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

    bookmarks = undefined

    init() {
        this.config = PixivFunc.readConfig()
        if (!this.config.proxy) {
            this.config.proxy = global.proxyUrl
            PixivFunc.writeConfig(this.config)
        }
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
                this.config.refresh_token = process.env["PIXIV_TOKEN"]
                PixivFunc.writeConfig(this.config)
                await PixivFunc.loginByToken(process.env["PIXIV_TOKEN"])
            }
            if (await this.pixivFunc.relogin()) {
                this.config = PixivFunc.readConfig()
                console.log("Pixiv 配置Token " + this.config.refresh_token)
            } else {

            }
            if (this.pixivFunc.pixiv == null) {
                console.log("Pixiv 登录失败")
                ctx.response.status = 403
                ctx.response.body = "Pixiv 登录失败"
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

    async getBookmark(r18, type, getLength = 100) {
        const auth = this.pixivApi.auth
        const userId = auth["user"]["id"]
        r18 = parseInt(r18 ?? 0)

        if (this.bookmarks == undefined) {
            console.log(`请求收藏`)
            this.bookmarks = []

            let max_bookmark_id = undefined
            while (this.bookmarks.length < getLength) {

                try {
                    console.log(`请求收藏 lastid ${max_bookmark_id}`)
                    const result = await this.pixivApi.userBookmarksIllust(userId, {
                        max_bookmark_id: max_bookmark_id
                    })
                    if (result.illusts.length > 0) {
                        this.bookmarks.push(...result.illusts)
                    }

                    max_bookmark_id = undefined
                    if (result.next_url) {
                        const nextUrl = new URL(result.next_url)
                        max_bookmark_id = nextUrl.searchParams.get('max_bookmark_id')
                    }
                    if (!max_bookmark_id) break

                    await setTimeout(100)
                } catch (error) {
                    console.log(error)
                    break
                }
            }

            console.log(`收藏数量 ${this.bookmarks.length}`)
        }





        if (this.bookmarks) {
            console.log(`筛选收藏 r18=${r18} type=${type}`)
            const ret = { illusts: this.filterIllusts(this.bookmarks, r18, type) };

            console.log("筛选结果 " + ret.illusts.length)
            return ret
        }

        return this.bookmarks
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
        const quality = ctx.request.query.quality ?? 'large' //
        // large
        // medium
        // original
        // square_medium 
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
        let o = {}
        Object.entries(detail.illust.meta_single_page).shift()

        if (detail) {
            console.log(detail)
            console.log(detail.illust.id)
            let image_urls = undefined
            if (detail.illust.meta_pages.length > 0) {
                const page = detail.illust.meta_pages[randomInt(detail.illust.meta_pages.length)]
                image_urls = page.image_urls
            } else if (detail.illust.meta_single_page && Object.entries(detail.illust.meta_single_page).length > 0) {
                image_urls = {}
                image_urls[quality] = Object.values(detail.illust.meta_single_page)[0]
            } else {
                image_urls = detail.illust.image_urls
            }

            let uri
            if (image_urls) {
                for (const k in image_urls) {
                    uri = new URL(image_urls[k])
                    if (k === quality) {
                        break
                    }
                }
            }

            if (uri) {
                uri.host = 'i.pixiv.ddns-ip.net'
                ctx.redirect(uri.toString())
                return
            }
        }

    }
}