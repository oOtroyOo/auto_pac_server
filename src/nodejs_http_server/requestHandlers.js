import fs from "fs";
import http from "http"

import Wakeup from "wakeup";
import Server from "./server.js"
import Socket from "dgram";
import mime from "mime-types";
import FileServer from "file-server";
import findLocalDevices from "local-devices";
import Koa from 'koa';
import os from 'os';
import dns from 'dns/promises'

import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises';
import { log, time } from "console";

/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function hello(ctx, next) {
    // await next()
    var request = ctx.request
    var response = ctx.response
    var content = "Hello World"
    if (request.url.indexOf('?') > 0) {
        content += request.url.substring(request.url.indexOf('?') + 1)
    }
    console.log(content);
    ctx.status = 200
    ctx.type = "text/plain"
    ctx.body = content
    await next()
}

/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function test(ctx, next) {
    const k = Date.now().toString()
    console.log("test in")
    await setTimeout(2000);
    ctx.status = 200
    console.log("test finish")
    await next()
    console.log("test out")
}


/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function error(ctx, next) {
    undefined()
}

const pachandle = {};
/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function pac(ctx, next) {
    // await next()
    const update_pac = new (await import("../update_pac.js")).default()

    var request = ctx.request
    var response = ctx.response
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
            const _content = await pachandle[host];
            content = _content

        } catch (error) {
            console.log("ERROR", error)
            if (content == null) {
                throw error
            }
        } finally {
            pachandle[host] = null
        }
    }
    // response.set({
    //     "Content-Type": "text/plain"
    // })
    ctx.type = "text/plain"
    ctx.body = content;
    await next()
}

const default_mac = "70-85-C2-CB-E4-B2"
/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function wakeup(ctx, next) {
    var request = ctx.request
    var response = ctx.response
    let path
    if (request.url.indexOf('?') > 0) {
        path = request.url.substring(request.url.indexOf('?') + 1)
    }


    let result = ""
    // let done = false;
    let targeIp
    let mac
    try {
        let results = await dns.lookup(path, 4)
        console.log(results)
        targeIp = results.address
    } catch (error) {
        console.error(error)
    }
    if (!targeIp) {
        try {
            mac = (path || default_mac).replaceAll("-", ":")
            Wakeup.parseMAC(mac)
        } catch (error) {
            console.error(error)
        }
    }

    let code = 200
    var targetList = []


    var interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        if (devName == undefined || devName.indexOf("Virtural") > -1 || devName.indexOf("VMware") > -1 || devName.indexOf("vEther") > -1) {
            continue
        }

        let iface = interfaces[devName];

        for (const alias of iface) {
            if (alias.family === 'IPv4' && alias.address != "127.0.0.1" && alias.netmask != "255.255.255.255") {
                if (targeIp == undefined || (ipToInt(targeIp) & ipToInt(alias.netmask)) == (ipToInt(alias.address) & ipToInt(alias.netmask))) {
                    let strTarget = intToIp(ipToInt(alias.address) | ~ipToInt(alias.netmask))
                    let range = intToIp(ipToInt(alias.address) & ipToInt(alias.netmask)) + "-" + strTarget
                    let devices = await findLocalDevices({ address: range, skipNameResolution: false })
                    let findDevice = devices.find((d) => {
                        return (mac ? mac.toLocaleLowerCase() == d.mac.toLocaleLowerCase() : targeIp == d.ip)
                    })
                    if (findDevice) {
                        mac = findDevice.mac
                        targeIp = findDevice.ip
                        result += "MAC:" + mac + " Find:" + targeIp + "\n"
                        strTarget = targeIp
                        console.log(result)
                        targetList.push(targeIp)
                    } else {
                        targetList.push(strTarget)
                    }
                }

            }
        }
    }

    if (!mac) {
        console.error("未定义 Mac")
        await next()
        return
    }

    let promiseList = []
    for (const strTarget of targetList) {
        console.log("广播推送 " + strTarget)
        result += ("广播推送 " + strTarget) + "\n"
        promiseList.push(new Promise((resolve, reject) => {
            try {
                /**@type {Socket}    */
                let socket = Wakeup.sendWOL(Wakeup.parseMAC(mac),
                    {
                        address: strTarget
                    },
                    (error) => {
                        // done = true
                        result += error + "\n"
                        if (error && error != "") {
                            code = 500
                        }
                        console.log("广播结束 " + strTarget)
                        resolve(true)
                    })

            } catch (error) {
                console.error(error.stack)
                // done = true
                code = 500
                result += error + "\n"
            }
        }))
    }
    await Promise.allSettled(promiseList)

    ctx.status = code
    // response.set({
    //     "Content-Type": "text/plain"
    // })
    ctx.type = "text/plain"
    ctx.body = result
    await next()
}

/**
@param {http.IncomingMessage} request 
@param {http.ServerResponse} response 
*/

/*export*/ async function file(request, response) {

    const fileServer = new FileServer((error, request, response) => {
        response.statusCode = error.code || 500;
        response.writeHead(response.statusCode, { "Content-Type": "text/plain" });
        response.write(error.message);
        response.end();
    });

    let filePath = request.url.substring("/file/".length)
    filePath = decodeURI(filePath)

    try {
        fileServer.serveFile(filePath, mime.lookup(filePath))(request, response)
    } catch (error) {
        throw error
    }
}


function ipToInt(IP) {
    var result = IP.split('.')
    return (parseInt(result[0]) << 24
        | parseInt(result[1]) << 16
        | parseInt(result[2]) << 8
        | parseInt(result[3])) >>> 0;
}

function intToIp(INT) {
    return (INT >>> 24) + "." + (INT >> 16 & 0xFF) + "." + (INT >> 8 & 0xFF) + "." + (INT & 0xFF);
}
