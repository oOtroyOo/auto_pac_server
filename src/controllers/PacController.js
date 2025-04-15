import BaseController from './BaseController.js';
import fs from 'fs';
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

export default class PacController extends BaseController {

    pachandle = {}


    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        const update_pac = new (await import("../update_pac.js")).default();
        var request = ctx.request;
        var host = request.headers["host"];
        if (host != undefined && host != '') {
            var indexOf = host.indexOf(':');
            if (indexOf > 0) {
                host = host.substring(0, indexOf);
            }
        } else {
            host = '127.0.0.1';
        }
        let date = new Date();
        var target = './bin/pac_' + host + '.js';
        var content = null;
        var isToday = false;
        if (fs.existsSync(target)) {
            var stat = fs.statSync(target);
            isToday = stat.mtime.getFullYear() === date.getFullYear() &&
                stat.mtime.getMonth() === date.getMonth() &&
                stat.mtime.getDate() === date.getDate();
            content = fs.readFileSync(target).toString();
        }
        if (content == null || !isToday) {
            try {
                if (!this.pachandle) this.pachandle = {};
                if (this.pachandle[host] == null) {
                    console.log("new handle");
                    this.pachandle[host] = update_pac.process(target, host);
                }
                const _content = await this.pachandle[host];
                content = _content;
            } catch (error) {
                console.log("ERROR", error);
                if (content == null) {
                    throw error;
                }
            } finally {
                this.pachandle[host] = null;
            }
        }
        ctx.type = "text/plain";
        ctx.body = content;
        await super.request(ctx, next)
    }
}