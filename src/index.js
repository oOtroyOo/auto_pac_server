import Server from "./nodejs_http_server/server.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"
import * as proxy from "./proxy.js"
import http from "http"
import https from "https"
import Koa from 'koa';
import serve from 'koa-static';
import Router from 'koa-router';
import mount from 'koa-mount';
import convert from 'koa-convert';
import serveIndex from 'koa-serve-index'
import sslify from 'koa-sslify'
import fs from "fs";

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
const router = Router();

/* 中间件 */
app.use(async (ctx, next) => {
    console.log('start ' + ctx.method + ":" + ctx.URL);
    next();
    console.log('end ' + ctx.method + ":" + ctx.URL);
});

/* 路由部分 */
router.all('/', requestHandlers.hello);
Object.keys(requestHandlers).forEach(function (key) {
    router.all('/' + key, requestHandlers[key])
})
app.use(router.routes());
app.use(mount('/file', convert(serveIndex('./', { icons: true }))));
app.use(mount('/file', serve('./', { icons: true })));

// const server = http.createServer();
// server.listen(port);
app.listen(port)
    .addListener('connect', proxy._onConnect)

if (fs.existsSync('ssl/server.key') && fs.existsSync('ssl/server.key')) {
    app.use(sslify.default({
    }))
    https.createServer({
        key: fs.readFileSync('ssl/server.key'),
        cert: fs.readFileSync('ssl/server.crt')
    }, app.callback())
        .addListener('connect', proxy._onConnect)
        .listen(port + 1);
}
