import BaseController from './BaseController.js';
import Koa from 'koa';
import path from 'path';
import koa_local_git_lfs from 'koa-local-git-lfs'
import fs from 'fs';

// 参考文档：
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
// https://github.com/git-lfs/lfs-test-server

export default class LfsController extends BaseController {
    constructor(app, router) {
        super(app, router);
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
        const lfs = new koa_local_git_lfs(folder)
        router.use("/lfs", lfs.routes())
    }

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        await super.request(ctx, next);
    }
}
