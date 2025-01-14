import Server from "./nodejs_http_server/server.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"
import * as proxy from "./proxy.js"
import http, { request } from "http"
import https from "https"
import path from 'path';
import fs from "fs";
import contentType from 'content-type';
import Koa from 'koa';
import koaStatic from 'koa-static';
import koaRouter from 'koa-router';
import koaMount from 'koa-mount';
import koaConvert from 'koa-convert';
import koaServeIndex from 'koa-serve-index'
import koaSslify from 'koa-sslify'
import koaBodyParser from 'koa-bodyparser';
import koaBody from 'koa-body';
import koaCharset from 'koa-charset';
import koaETag from 'koa-etag';
import koaConditional from 'koa-conditional-get';

import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

let port = 8880
process.argv.forEach((val, index) => {
    console.log(`${index}: ${val}`);
    if (val.startsWith("--port")) {
        var split = val.indexOf('=')
        if (split > 0) {
            port = parseInt(val.substring(split + 1))
        }
    }
});

const app = new Koa();

/* 大try中间件 */
app.use(async (ctx, next) => {

    try {
        console.log('start ' + ctx.method + ":" + ctx.URL);
        await next(); // 插入等待后续接口
    } catch (e) {
        ctx.status = 500
        ctx.body = e.stack
        // e.expose = true
        // ctx.onerror(e)
        console.error(`\n${e.stack.replace(/^/gm, '  ')}\n`);
    } finally {
        console.log('end ' + ctx.method + ":" + ctx.URL);
    }
});


// 通用Header处理
app.use(async (ctx, next) => {
    var language = ctx.acceptsLanguages()
    if (language && language.length > 0 && language[0] != '*') {
        ctx.response.set('content-language', language[0])
    }

    var charset = ctx.acceptsCharsets()
    if (charset && charset.length > 0) {
    }

    var encoding = ctx.acceptsEncodings()
    if (encoding && encoding.length > 0) {
    }
    await next()
})


/* 解析Body部分 */
app.use(koaConditional())
app.use(koaCharset())
app.use(koaETag({ weak: false }))

const bodyEncoding = {
}
const bodyParse = koaBody.koaBody({})
app.use(async (ctx, next) => {
    const type = ctx.request.header["content-type"];
    if (type) {
        const parsedType = contentType.parse(type);
        if (parsedType && parsedType.parameters.charset) {
            if (bodyEncoding[parsedType.parameters.charset] == undefined) {
                bodyEncoding[parsedType.parameters.charset] = koaBody.koaBody({
                    encoding: parsedType.parameters.charset
                })
            }
            await bodyEncoding[parsedType.parameters.charset](ctx, next)
            return
        }
    }
    await bodyParse(ctx, next)
});

// app.use(bodyParser());
// app.use(koaBody.koaBody({}));

/* 路由部分 */
const router = new koaRouter({ strict: true });
router.all('/', requestHandlers.hello);
Object.keys(requestHandlers).forEach(function (key) {
    router.all('/' + key, requestHandlers[key])
})

app.use(router.routes());



/* 文件传递部分 */
const serveIndexFunc = koaConvert(koaServeIndex('./', { icons: true, view: 'details' }))
app.use(koaMount('/file', async (ctx, next) => {
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
app.use(koaMount('/file', koaStatic('./', {})));

try {
    const certFile = "ECC-cert.pem"
    const keyFile = "ECC-privkey.pem"
    fs.accessSync(certFile)
    fs.accessSync(keyFile)
    app.use(koaSslify.default({
        port: port
    }))
    // app.use(sslMidware)
    app.listen(port + 1, () => {
        console.log("start " + (port + 1))
    })
        .addListener('connect', proxy._onConnect)
    https.createServer({
        cert: fs.readFileSync(certFile),
        key: fs.readFileSync(keyFile)
    }, app.callback())
        .addListener('connect', proxy._onConnect)
        .listen(port, () => {
            console.log("start " + port)
        });

} catch (error) {
    console.log("本地ssl文件无效 " + error)

    app.listen(port, () => {
        console.log("start " + port)
    })
        .addListener('connect', proxy._onConnect)
}
