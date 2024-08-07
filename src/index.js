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
        await next();
        console.log('end ' + ctx.method + ":" + ctx.URL);
    } catch (e) {
        // 如果后面的代码报错 返回500
        ctx.status = 500
        ctx.body = e.stack
        // e.expose = true
        // ctx.onerror(e)
        console.error(`\n${e.stack.replace(/^/gm, '  ')}\n`);
    }
});

/* 路由部分 */
router.all('/', requestHandlers.hello);
Object.keys(requestHandlers).forEach(function (key) {
    router.all('/' + key, requestHandlers[key])
})
app.use(router.routes());
// app.use(mount('/file', convert(serveIndex('./', { icons: true }))));
// app.use(mount('/file', serve('./', { icons: true })));

// const server = http.createServer();
// server.listen(port);
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
