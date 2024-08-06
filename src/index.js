import Server from "./nodejs_http_server/server.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"
import * as proxy from "./proxy.js"
import http from "http"
import Koa from 'koa';
import Router from 'koa-router';
import serve from 'koa-static';
import mount from 'koa-mount';
import convert from 'koa-convert';
import serveIndex from 'koa-serve-index'
import co from 'co'
import c2k from 'koa-connect'

process.argv.forEach((val, index) => {
    console.log(`${index}: ${val}`);
    if (val.startsWith("--port")) {
        var split = val.indexOf('=')
        if (split > 0) {
            var port = parseInt(val.substring(split + 1))
            Server.port = port
        }
    }
});


const app = new Koa();
const router = Router();

// Example Connect middleware
const connectMiddleware = (req, res, next) => {
    console.log('Connect middleware triggered');
    next();
};

app.use(c2k(connectMiddleware));


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
let server = app.listen(8880);
// const server = http.createServer();
// server.listen(8880);
server.addListener('connect', proxy._onConnect)
