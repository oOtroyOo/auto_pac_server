import Server from "./nodejs_http_server/server.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"
import * as proxy from "./proxy.js"
import http, { request } from "http"
import https from "https"
import Koa from 'koa';
import serve from 'koa-static';
import Router from 'koa-router';
import mount from 'koa-mount';
import convert from 'koa-convert';
import serveIndex from 'koa-serve-index'
import sslify from 'koa-sslify'
import fs from "fs";
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises';

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
const router = new Router({ strict: true });
var sslMidware
if (fs.existsSync('ssl/server.key') && fs.existsSync('ssl/server.key')) {
    sslMidware = sslify.default({
        port: port + 1
    })
}

/* 中间件 */
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

// 通用处理
app.use(async (ctx, next) => {
    var language = ctx.acceptsLanguages()
    if (language && language.length > 0) {
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

/* 路由部分 */
router.all('/', requestHandlers.hello);
Object.keys(requestHandlers).forEach(function (key) {
    router.all('/' + key, requestHandlers[key])
})

app.use(router.routes());

app.use(mount('/file', convert(serveIndex('./', { icons: true }))));
app.use(mount('/file', serve('./', { icons: true })));

app.listen(port)
    .addListener('connect', proxy._onConnect)

if (sslMidware) {
    // app.use(sslMidware)
    https.createServer({
        key: fs.readFileSync('ssl/server.key'),
        cert: fs.readFileSync('ssl/server.crt')
    }, app.callback())
        .addListener('connect', proxy._onConnect)
        .listen(port + 1);
}
