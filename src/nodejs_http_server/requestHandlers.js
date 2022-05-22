import fs from "fs";
import * as update_pac from "../update_pac.js";
import Server from "./server.js"

export function hello(query, response) {
    console.log("Hello World");
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write("Hello World");
    response.end();
}
const ipTest = new RegExp("\\d+\\.\\d+\\.\\d+\\.\\d+")

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
    if (true || content == null || !isToday) {
        fs.mkdir('./bin', 777, function () { })
        try {
            let domains = await update_pac.getDomains()
            content = await update_pac.writeFile(domains, target, host);
            console.log(`${target} 文件已更新${domains.length}个域名`);
        } catch (error) {
            console.log("ERROR", error)
            if (content == null) {
                throw error
            }
        }

    }

    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write(content);
    response.end();
}
