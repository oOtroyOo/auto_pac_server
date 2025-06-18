import BaseController from './BaseController.js'
import koaStatic from 'koa-static';
import koaMount from 'koa-mount';
import koaConvert from 'koa-convert';
import path from "path";
import fs from "fs";
import koaServeIndex from 'koa-serve-index'
export default class FileController extends BaseController {
    init() {
        super.init()
        /* 文件传递部分 */
        const serveIndexFunc = koaConvert(koaServeIndex('./', { icons: true, view: 'details' }))
        this.app.use(koaMount('/file', async (ctx, next) => {
            if (ctx.method.toUpperCase() == "GET") {
                if (ctx.accept.headers.accept === "*/*") {
                    try {
                        var localPath = path.resolve("." + decodeURIComponent(ctx.path))
                        var stat = fs.statSync(localPath)
                        if (stat.isDirectory()) {
                            ctx.accept.headers.accept = "application/json"
                        }
                    } catch (error) {
                        console.log(error)
                    }
                }
                await serveIndexFunc(ctx, next)
            } else if (["POST", "PUT"].includes(ctx.method.toUpperCase())) {
                try {
                    var filePath = path.resolve("." + decodeURIComponent(ctx.path))
                    if (fs.existsSync(filePath)) {
                        ctx.status = 302
                    } else {
                        // 兼容 buffer 或 stream
                        if (ctx.req.readable) {
                            ctx.status = 200
                            // 直接管道写入文件
                            const writeStream = fs.createWriteStream(filePath);
                            await new Promise((resolve, reject) => {
                                ctx.req.pipe(writeStream);
                                ctx.req.on('end', resolve);
                                ctx.req.on('error', reject);
                                writeStream.on('error', reject);
                            });
                        } else if (ctx.request.body) {
                            ctx.status = 200
                            // 直接写入 buffer
                            fs.writeFileSync(filePath, ctx.request.body);
                        }

                    }
                } catch (error) {
                    console.log(error)
                }
            } else if (["PATCH"].includes(ctx.method.toUpperCase())) {
                try {
                    var filePath = path.resolve("." + decodeURIComponent(ctx.path))
                    if (!fs.existsSync(filePath)) {
                        ctx.status = 302
                    } else {
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
                            ctx.status = 200
                        } else if (ctx.request.body) {
                            // 直接写入 buffer
                            fs.writeFileSync(filePath, ctx.request.body);
                            ctx.status = 200
                        }

                    }
                } catch (error) {
                    console.log(error)
                }
            } else if (["DELETE"].includes(ctx.method.toUpperCase())) {
                try {
                    var filePath = path.resolve("." + decodeURIComponent(ctx.path))
                    if (!fs.existsSync(filePath)) {
                        ctx.status = 302
                    } else {
                        fs.unlinkSync(filePath);
                        ctx.status = 200;

                    }
                } catch (error) {
                    console.log(error)
                }
            }

            await next()
        }));
        this.app.use(koaMount('/file', koaStatic('./', {})));
    }

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        await super.request(ctx, next);
    }

    /**
    @param {http.IncomingMessage} request 
    @param {http.ServerResponse} response 
    */
    async file(request, response) {

        const fileServer = new FileServer((error, request, response) => {
            response.statusCode = error.code || 500;
            response.writeHead(response.statusCode, { "Content-Type": "text/plain" });
            response.write(error.message);
            response.end();
        });

        let filePath = request.url.substring("/file/".length)
        filePath = decodeURI(filePath)

        try {
            fileServer.serveFile(filePath, mime.lookup(filePath))(request, response)
        } catch (error) {
            throw error
        }
    }
}