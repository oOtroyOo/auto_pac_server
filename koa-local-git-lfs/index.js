import Koa from 'koa';
import koaRouter from 'koa-router';
import LfsController from './lfs.js';
import util from 'util';
import bodyParser from 'koa-bodyparser';
import { ArgumentParser } from 'argparse';
const debug = util.debuglog('koa_git_lfs_server');
const parser = new ArgumentParser({
    description: 'Argparse 示例'
});

parser.add_argument('-p', '--port', { required: true, help: "Port" });
parser.add_argument('-d', '--dir', { required: true, help: "LocalDir" });
parser.add_argument('-r', '--route', { required: false, help: "Route Path. default /lfs " });


const args = parser.parse_args();

const app = new Koa();
app.use(async (ctx, next) => {

    try {
        console.log(`${'start'.padEnd(6)}${ctx.method.padEnd(5)}${ctx.URL}`);
        await next(); // 插入等待后续接口
    } catch (e) {
        ctx.status = 500
        ctx.body = `${e.message}\n${e.stack}\n`
        console.error(`\n${e.stack.replace(/^/gm, '  ')}\n`);
    } finally {
        console.log(`${'end'.padEnd(6)}${ctx.method.padEnd(5)}${ctx.URL}`);
    }
});

app.use(async (ctx, next) => {
    if (ctx.path.match('/objects/[a-fA-F0-9]{32,128}$')) ctx.disableBodyParser = true;
    await next();
});

app.use(bodyParser({
    enableTypes: ['json', 'form', 'text', 'xml'],
    extendTypes: { json: "+json" },
    multipart: true,
}));

const router = new koaRouter({ strict: true });

const lfs = new LfsController(args.dir)
router.use(args.route || "/lfs", lfs.routes())
app.use(router.routes());

const port = args.port
app.listen(port, () => {
    console.log("server listen " + port)
})
