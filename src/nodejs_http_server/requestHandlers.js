import fs from "fs";
import _update_pac from "../update_pac.js";
const update_pac = new _update_pac()
import Server from "./server.js"

export function hello(query, response) {
    console.log("Hello World");
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write("Hello World");
    response.end();
}
const ipTest = new RegExp("\\d+\\.\\d+\\.\\d+\\.\\d+")

var pachandle = {};
export async function pac(request, response) {
    /** @type string */
    var host = request.headers["host"]
    if (host != undefined && host != '') {
        var indexOf = host.indexOf(':')
        if (indexOf > 0) {
            host = host.substring(0, indexOf)
        }
    } else {
        host = '127.0.0.1'
    }
    let date = new Date()
    let str = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
    var target = './bin/pac_' + host + '.js';
    var content = null
    var isToday = false;
    if (fs.existsSync(target)) {
        //fs.utimes(path,atime,mtime,callback)
        //atime:访问时间
        //mtime：修改时间
        var stat = fs.statSync(target)
        isToday = stat.mtime.getFullYear() === date.getFullYear() &&
            stat.mtime.getMonth() === date.getMonth() &&
            stat.mtime.getDate() === date.getDate();
        content = fs.readFileSync(target).toString()
    }
    if (content == null || !isToday) {
        try {
            if (pachandle[host] == null) {
                console.log("new handle")
                pachandle[host] = update_pac.process(target, host)
            }
            content = await pachandle[host];

        } catch (error) {
            console.log("ERROR", error)
            if (content == null) {
                throw error
            }
        } finally {
            pachandle[host] = null
        }
    }

    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write(content);
    response.end();
}
