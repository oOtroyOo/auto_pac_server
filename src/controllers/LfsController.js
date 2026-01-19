import BaseController from './BaseController.js';
import Koa from 'koa';
import KoaRouter from 'koa-router'
import path from 'path';
import koa_local_git_lfs from 'koa-local-git-lfs'
import fs from 'fs';
import { URL } from 'url';

// 参考文档：
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
// https://github.com/git-lfs/lfs-test-server

export default class LfsController extends BaseController {
    /**
     * 
     * @param {Koa} app 
     * @param {KoaRouter} router 
     */
    constructor(app, router) {
        super(app, router);

    }
    init() {
        // super.init()
        let folder = path.resolve(process.cwd(), 'lfs_objects')
        process.argv.forEach((val, index) => {
            if (val.startsWith("--lfs-root")) {
                var split = val.indexOf('=')
                if (split > 0) {
                    folder = val.substring(split + 1)
                }
            }
        });
        console.log("LFS root folder: " + folder)

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder)
        }
        this.lfs = new koa_local_git_lfs(folder, this.hostBuilder, async (ctx, next) => await this.request(ctx, next))
        // router.use('/lfs/*path',     this.lfs.routes())
        this.router.use('/lfs', this.lfs.routes())
        console.log(`LFS router stack ${this.router.stack.length}: ${JSON.stringify(this.router.stack)}`)
    }

    hostBuilder(ctx) {
        let pfx = ctx.header['prefix']
        // pfx = "/node"
        if (pfx) {
            let scechme
            // 如果host匹配并不是ip地址
            if (ctx.host.match(/^\d+\.\d+\.\d+\.\d+/)) {
                scechme = "http"

            } else {
                scechme = "https"
            }

            return `${scechme}://${ctx.host}${pfx}`
            // this.lfs.lfsRouter.prefix(`/lfs/${pfx}`)
        } else {
            return undefined
        }
    }
    /**
     * 
        @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
        @param {Koa.Next} next 
     */
    async request(ctx, next) {
        // let pfx = ctx.header['prefix']// 从nginx.conf中传递过来的
        // pfx = "/node"
        // if (pfx) {
        //     let scechme
        //     // 如果host匹配并不是ip地址
        //     if (ctx.host.match(/^\d+\.\d+\.\d+\.\d+/)) {
        //         scechme = "http"

        //     } else {
        //         scechme = "https"
        //     }

        //     this.lfs.baseUrl = `${scechme}://${ctx.host}${pfx}`
        //     // this.lfs.lfsRouter.prefix(`/lfs/${pfx}`)
        // } else {
        //     this.lfs.baseUrl = undefined
        //     // this.lfs.lfsRouter.prefix(`/lfs`)
        // }

        await super.request(ctx, next);
        // if (ctx.originalUrl.endsWith("/objects/batch")) {
        //     console.log(`LFS batch CTX:  ${JSON.stringify(ctx)}\nprefix: ${pfx}\nbaseUrl: ${this.lfs.baseUrl}`)
        //     if (ctx.body && ctx.body.objects) {
        //         console.log(`LFS batch END:  ${JSON.stringify(ctx.body.objects[0])}`)
        //     }
        // }
    }
}
