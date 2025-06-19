import BaseController from './BaseController.js';
import Koa from 'koa';
import path from 'path';
import koa_local_git_lfs from 'koa-local-git-lfs'
// 参考文档：
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
// https://github.com/git-lfs/lfs-test-server

export default class LfsController extends BaseController {
    constructor(app, router) {
        super(app, router);
        const lfs = new koa_local_git_lfs(path.resolve(process.cwd(), 'lfs_objects'))
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
