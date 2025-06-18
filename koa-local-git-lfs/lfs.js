import fs from 'fs';
import Koa from 'koa';
import koaRouter from 'koa-router';
import path from 'path';

// 参考文档：
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
// https://github.com/git-lfs/lfs-test-server

export default class LfsController {
    constructor(rootDir) {
        this.rootDir = rootDir || path.resolve('./lfs_objects')
        console.log(`lfs-root: ${this.rootDir}`);
    }

    routes() {
        /** @type {koaRouter} */
        this.lfsRouter = new koaRouter({ strict: true });
        // LFS batch API
        this.lfsRouter.post(`/*project/objects/batch`, async (ctx, next) => await this.batch(ctx, next));
        // LFS object upload/download
        this.lfsRouter.get(`/*project/objects/:oid`, async (ctx, next) => await this.download(ctx, next));
        this.lfsRouter.put(`/*project/objects/:oid`, async (ctx, next) => await this.upload(ctx, next));
        return this.lfsRouter.routes()
    }

    /**
     * 处理 LFS batch 请求
     * 参考: https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
     */
    /**
   @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
   @param {Koa.Next} next 
   */
    async batch(ctx, next) {
        const { operation, objects } = ctx.request.body || {};
        if (!objects || !Array.isArray(objects)) {
            ctx.status = 400;
            ctx.body = { message: 'Invalid objects' };
            return;
        }
        const project = ctx.params.project;
        ctx.body = {
            transfer: 'basic',
            objects: await Promise.all(objects.map(async obj => {
                const oid = obj.oid;
                const size = obj.size;
                const objPath = this.getObjectPath(project, oid);
                let exists = false;
                try {
                    const stat = fs.statSync(objPath);
                    exists = stat.size === size;
                } catch (e) {
                    if (e.code != 'ENOENT')
                        console.log(e)
                }
                const actions = {};
                const href = `${ctx.protocol}://${ctx.host}${ctx.originalUrl.substring(0, ctx.originalUrl.lastIndexOf('/') + 1)}${oid}`;
                if (operation === 'download' && exists) {
                    actions.download = {
                        href: href
                    };
                } else if (operation === 'upload' && !exists) {
                    actions.upload = {
                        href: href,
                        header: {}
                    };
                }
                return {
                    oid,
                    size,
                    authenticated: false,
                    actions
                };
            }))
        };
        await next();
    }

    /**
     * 处理 LFS 对象下载
     * 参考: https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
     */
    /**
    @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
    @param {Koa.Next} next 
    */
    async download(ctx, next) {
        const oid = ctx.params.oid;
        const project = ctx.params.project;
        const filePath = this.getObjectPath(project, oid);
        if (fs.existsSync(filePath)) {
            ctx.status = 200;
            ctx.type = "application/octet-stream";
            ctx.body = fs.createReadStream(filePath);
        } else {
            ctx.status = 404;
            ctx.body = { message: `Object ${oid} not found` };
        }
        await next();
    }

    /**
     * 处理 LFS 对象上传
     * 参考: https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md
     */
    /**
    @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
    @param {Koa.Next} next 
    */
    async upload(ctx, next) {
        const oid = ctx.params.oid;
        const project = ctx.params.project;
        const filePath = this.getObjectPath(project, oid);

        // 兼容 buffer 或 stream
        if (ctx.req.readable) {
            // 直接管道写入文件
            const writeStream = fs.createWriteStream(filePath);
            await new Promise((resolve, reject) => {
                ctx.req.pipe(writeStream);
                ctx.req.on('end', resolve);
                ctx.req.on('error', reject);
                writeStream.on('error', reject);
            });
        } else if (ctx.request.body) {
            // 直接写入 buffer
            fs.writeFileSync(filePath, ctx.request.body);
        }

        ctx.status = 200;
        ctx.body = '';
        await next();
    }

    getStorageDir(project) {
        // 按项目分目录
        const dir = path.resolve(this.rootDir, project);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    getObjectPath(project, oid) {
        return path.join(this.getStorageDir(project), oid);
    }
}
