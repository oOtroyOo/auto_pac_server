import * as proxy from "./proxy.js"
import url from "url"
import https from "https"
import path from 'path';
import tls from 'tls';
import fs from "fs";
import contentType from 'content-type';
import Koa from 'koa';
import koaRouter from 'koa-router';
import koaSslify from 'koa-sslify'
import koaBody from 'koa-body';
import bodyParser from 'koa-bodyparser';
import koaCharset from 'koa-charset';
import koaETag from '@koa/etag';
import koaConditional from 'koa-conditional-get';
import cacheControl from 'koa-cache-control';
import LfsController from './controllers/LfsController.js';

import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

exec
const __filename = url.fileURLToPath(import.meta.url).replaceAll('\\', '/')
const __dirname = path.dirname(__filename).replaceAll('\\', '/')
// const __filename = import.meta.filename;
// const __dirname = import.meta.dirname;

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
        console.log('start ' + ctx.method + ":" + ctx.URL + " ip=" + ctx.request.ip);

        // 如果使用了代理，那么可以通过以下方式获取真实 IP
        const xForwardedFor = ctx.request.header['x-forwarded-for'];
        if (xForwardedFor) {
            console.log('x-forwarded-for: ' + xForwardedFor);
        }

        await next(); // 插入等待后续接口
    } catch (e) {
        ctx.status = 500
        ctx.body = `${e.message}\n${e.stack}\n`
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

    // ctx.response.set('Content-Type', 'text/plain; charset=utf-8')
    ctx.type = "text/plain";
    await next()
})


/* 解析Body部分 */
app.use(koaConditional())
app.use(koaCharset())
app.use(koaETag({ weak: false }))
// 使用koa-cache-control中间件，并设置缓存策略
app.use(cacheControl({
    // maxAge: 60 * 60 * 24, // 缓存1天
    noCache: false, // 允许缓存
    // mustRevalidate: true // 要求重新验证
}));


// const bodyEncoding = {
// }
// const bodyParse = koaBody.koaBody({})
// app.use(async (ctx, next) => {
//     const type = ctx.request.header["content-type"];
//     if (type) {
//         const parsedType = contentType.parse(type);
//         if (parsedType && parsedType.parameters.charset) {
//             if (bodyEncoding[parsedType.parameters.charset] == undefined) {
//                 bodyEncoding[parsedType.parameters.charset] = koaBody.koaBody({
//                     encoding: parsedType.parameters.charset
//                 })
//             }
//             await bodyEncoding[parsedType.parameters.charset](ctx, next)
//             return
//         }
//     }
//     await bodyParse(ctx, next)
// });


// app.use(koaBody.koaBody({}));

app.use(async (ctx, next) => {
    if (ctx.path.match('/objects/[a-fA-F0-9]{32,128}$')) ctx.disableBodyParser = true;
    await next();
});
app.use(bodyParser({
    enableTypes: ['json', 'form', 'text', 'xml'],
    extendTypes: { json: "+json" },
    multipart: true,
}));
// app.use(koaBody.koaBody({}));

/* 路由部分 */
const router = new koaRouter({ strict: true });
global.myControllers = []

let isError = false
for (let localFile of fs.readdirSync(`${__dirname}/controllers`)) {
    try {
        localFile = `./controllers/${localFile}`
        console.log(localFile)
        const Controller = (await import(localFile)).default;
        if (Controller && typeof Controller === 'function') {
            let obj = new Controller(app, router);
            global.myControllers.push(obj)
        }
    } catch (error) {
        console.error(`Failed to load controller from file: ${localFile}`, error);
        isError = true
    }
}

if (isError) {
    process.exit(1)
}

app.use(router.routes());
app.use(router.allowedMethods());

try {
    const certs = {}

    if (fs.existsSync("cert")) {
        fs.readdirSync("cert").forEach((dir) => {
            const certPath = path.join("cert", dir, 'cert.pem');
            const keyPath = path.join("cert", dir, 'privkey.pem');
            console.log(certPath)
            // Check if both cert.pem and privkey.pem exist in the directory
            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {

                certs[dir] = {
                    cert: fs.readFileSync(certPath),
                    key: fs.readFileSync(keyPath)
                };
            }
        });
    }

    if (Object.keys(certs).length > 0) {
        console.log('USE SSL')
        app.use(koaSslify.default({
            port: port
        }))
        const httpsOptions = {
            SNICallback: (servername, cb) => {
                cb(null, tls.createSecureContext(certs[servername]));
            },
            cert: certs[Object.keys(certs)[0]].cert,
            key: certs[Object.keys(certs)[0]].key
        }
        https.createServer(httpsOptions, app.callback())
            .addListener('connect', proxy._onConnect)
            .listen(port, () => {
                console.log("start " + port)
            });
    } else {
        console.log('NO SSL')
        app.listen(port, () => {
            console.log("start " + port)
        })
            .addListener('connect', proxy._onConnect)
    }
} catch (error) {
    console.log("服务器启动失败 " + error)
}

