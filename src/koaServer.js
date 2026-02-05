import url from "url"
import path from 'path';
import fs, { glob } from "fs";
import Koa from 'koa';
import koaRouter from 'koa-router';
import koaSslify from 'koa-sslify'
import bodyParser from 'koa-bodyparser';
import koaCharset from 'koa-charset';
import koaETag from '@koa/etag';
import koaConditional from 'koa-conditional-get';
import cacheControl from 'koa-cache-control';
import * as child_process from 'child_process'
import { KoaWithMyInterface } from './Interfaces/Defines.js'
import axios, { AxiosError } from 'axios';
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

console.log("Node:v" + process.version)
import events from 'events'
events.EventEmitter.defaultMaxListeners = 20;

const __filename = url.fileURLToPath(import.meta.url).replaceAll('\\', '/')
const __dirname = path.dirname(__filename).replaceAll('\\', '/')
// const __filename = import.meta.filename;
// const __dirname = import.meta.dirname;

/** @type { KoaWithMyInterface } */
const app = new Koa();

app.MyConfig = {
    NeedProxyUrl: [
        /.*\.pixiv\.net$/,
        /.*\.pximg\.net$/
    ],
    RefererMap: [
        [/.*\.pximg\.net$/, "https://www.pixiv.net/"]
    ],
    pixivCdn: ["i.pixiv.ddns-ip.net", "i.yuki.sh", "i.pixiv.re"],
    proxyUrl: undefined,
}
app.MyConfig.pixivCdnHost = new Promise(async (resolve, reject) => {
    try {
        var tasks = (await Promise.allSettled(app.MyConfig.pixivCdn.map(url => new Promise(async (resolve1, reject1) => {
            let start = Date.now()
            try {
                const response = await axios.head(`https://${url}`);
                resolve1([url, Date.now() - start])
                return
            } catch (e) {
                if (e instanceof AxiosError) {
                    if (typeof (e.status) == "number" && e.status >= 200) {
                        resolve1([url, Date.now() - start])
                        return
                    }
                }
                console.log(e)

                reject1(`${url}响应失败${e}`)
                return
            }
        }))))
        var success = tasks.filter(r => r.status === 'fulfilled').map(r => r.value);
        var failed = tasks.filter(r => r.status === 'rejected').map(r => r.reason)

        if (success.length > 0) {
            success.sort((a, b) => a[1] - b[1])
            console.log(`${success[0][0]}响应最快，${success[0][1]}ms\n${success}`)
            resolve(success[0][0])
        }
    } catch (e) {
        console.log(e)
        reject(e)
        return
    }
    reject("ping pixivCDN 失败")
});


const proxyPort = 10809
if (process.platform.indexOf("win") >= 0) {
    const result = child_process.execSync(`cmd /c netstat -ano | findstr 0.0.0.0:${proxyPort}`, {
        encoding: 'ascii'
    })
    if (result.trim().length > 0 && result.indexOf("LISTENING") >= 0)
        app.MyConfig.proxyUrl = `http://localhost:${proxyPort}`;
}

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
        console.error(`\n${e.stack != null ? e.stack.replace(/^/gm, '  ') : e}\n`);
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


app.myControllers = []

let isError = false
for (let localFile of fs.readdirSync(`${__dirname}/controllers`)) {
    try {
        localFile = `./controllers/${localFile}`
        console.log(localFile)
        const Controller = (await import(localFile)).default;
        if (Controller && typeof Controller === 'function') {
            let obj = new Controller(app, router);
            app.myControllers.push(obj)
        }
    } catch (error) {
        console.error(`Failed to load controller from file: ${localFile}`, error);
        isError = true
    }
}

if (isError) {
    process.exit(1)
}

// 将 router 的所有路由复制到 routerWithPrefix
const routerWithPrefix = new koaRouter({ strict: true });
routerWithPrefix.prefix('/node');
routerWithPrefix.use(router.routes())

app.use(router.routes());
app.use(routerWithPrefix.routes());
app.use(router.allowedMethods());
app.use(routerWithPrefix.allowedMethods());

export default app