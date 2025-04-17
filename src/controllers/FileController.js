import BaseController from './BaseController.js'
import koaStatic from 'koa-static';
import koaMount from 'koa-mount';
import koaConvert from 'koa-convert';
import koaServeIndex from 'koa-serve-index'
export default class EchoController extends BaseController {
    init() {
        super.init()
        /* 文件传递部分 */
        const serveIndexFunc = koaConvert(koaServeIndex('./', { icons: true, view: 'details' }))
        this.app.use(koaMount('/file', async (ctx, next) => {
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