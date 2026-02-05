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
import fs from 'fs'

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

/**
 * @typedef {Object} FilterDefine
 * @property {number} r18
 * @property {string} type
 * - ugoira
 * - illust
 * - manga
 * @property {string} tag
 * @property {number} ai 
 * - 0 = 全部作品（包括 AI）
 * - 1 = 仅原创（排除 AI）
 * - 2 = 仅 AI 作品
 */


export default class PixivController extends BaseController {

    config = PixivFunc.readConfig()
    pixivFunc = new PixivFunc()
    /** @type {PixivApi} */
    pixivApi = undefined

    bookmarks = undefined
    cdnHost = undefined

    init() {
        this.config = PixivFunc.readConfig()
        if (!this.config.proxy) {
            this.config.proxy = this.app.MyConfig.proxyUrl
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
        ctx.body = await this.getBookmark(ctx.request.query);
    }

    /** @param {FilterDefine} filterDefine  */
    async getBookmark(filterDefine, getLength = 200) {
        const auth = this.pixivApi.auth
        const userId = auth["user"]["id"]

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
                        this.bookmarks.push(...result.illusts.filter(illust => illust.visible))
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
            if (process.platform.indexOf("win") > -1) {
                const str = JSON.stringify(this.bookmarks, undefined, 4)
                fs.writeFileSync("bin/bookmarks.json", str)
            }
        }

        if (this.bookmarks) {
            const ret = { illusts: this.filterIllusts(this.bookmarks, filterDefine) };
            console.log("筛选结果 " + ret.illusts.length)

            return ret
        }

        return this.bookmarks
    }

    /** @param {*} illusts  */
    /** @param {FilterDefine} filterDefine  */
    filterIllusts(illusts, filterDefine) {
        if (!filterDefine) return illusts;

        const r18 = parseInt(filterDefine.r18 ?? 0)
        const ai = parseInt(filterDefine.ai ?? 0)
        return illusts.filter(illust => {
            return (illust.x_restrict === r18 || r18 == 2)
                && (filterDefine.type == undefined || illust.type === filterDefine.type)
                && (ai == 0 || illust.illust_ai_type === ai)
                && (filterDefine.tag == undefined || illust.tags.some(t => t.name === filterDefine.tag || t.translated_name === filterDefine.tag))
        })
    }


    /**
    * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
    * localhost:8880/pixiv/random?r18=0&type=illust&quality=large
    * for ($i = 0; $i -lt 10; $i++) { start "http://localhost:8880/pixiv/random?type=illust&quality=large" }
    */
    async random(ctx) {
        /** 
        * - large
        * - medium
        * - original
        * - square_medium  
        */
        const quality = ctx.request.query.quality ?? 'large' //
        const result = await this.getBookmark(ctx.request.query);

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
                uri.host = (await this.app.MyConfig.pixivCdnHost) ?? this.app.MyConfig.pixivCdn[0]
                console.log("重定向 " + uri)
                ctx.redirect(uri.toString())
                return
            }
        }

    }
}