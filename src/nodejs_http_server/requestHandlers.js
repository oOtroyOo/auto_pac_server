import fs from "fs";
import http from "http"
import _update_pac from "../update_pac.js";
import Wakeup from "wakeup";
const update_pac = new _update_pac()
import Server from "./server.js"
import Socket from "dgram";
import mime from "mime-types";
import FileServer from "file-server";
import findLocalDevices from "local-devices";
import Koa from 'koa';

/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export function hello(ctx, next) {
    var request = ctx.request
    var response = ctx.response
    var content = "Hello World"
    if (request.url.indexOf('?') > 0) {
        content += request.url.substring(request.url.indexOf('?') + 1)
    }
    console.log(content);
    response.type = "text/plain"
    response.body = content
}

const ipTest = new RegExp("\\d+\\.\\d+\\.\\d+\\.\\d+")

var pachandle = {};


/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function pac(ctx, next) {
    var request = ctx.request
    var response = ctx.response
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
    // response.set({
    //     "Content-Type": "text/plain"
    // })
    response.type = "text/plain"
    response.body = content;
}


/**
@param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
@param {Koa.Next} next 
*/
export async function wakeup(ctx, next) {
    var request = ctx.request
    var response = ctx.response
    let mac = "70-85-C2-CB-E4-B2"
    let bradcast = "192.168.2.255"
    if (request.url.indexOf('?') > 0) {
        mac = request.url.substring(request.url.indexOf('?') + 1)
    }
    mac = mac.replaceAll("-", ":")

    let result = ""
    let done = false;
    let parseMAC = Wakeup.parseMAC(mac)

    let devices = await findLocalDevices()
    result += "MAC:" + mac + " Find:" + (devices.find((d) => {
        return mac.toLocaleLowerCase() == d.mac.toLocaleLowerCase()
    })?.ip) + "\n"

    console.log(result);
    let code = 200
    try {
        /**@type {Socket}    */
        let socket = Wakeup.sendWOL(parseMAC,
            {
                address: bradcast
            },
            (error) => {
                done = true
                result += error
                if (error && error != "") {
                    code = 500
                }
            })
    } catch (error) {
        done = true
        code = 500
        result += error
    }

    await new Promise(function (resolve, reject) {
        (function waitForFoo() {
            if (done) return resolve();
            setTimeout(waitForFoo, 30);
        })();
    });
    response.status = code
    // response.set({
    //     "Content-Type": "text/plain"
    // })
    response.type = "text/plain"
    response.body = result
}


const fileServer = new FileServer((error, request, response) => {
    response.statusCode = error.code || 500;
    response.writeHead(response.statusCode, { "Content-Type": "text/plain" });
    response.write(error.message);
    response.end();
});


/**
@param {http.IncomingMessage} request 
@param {http.ServerResponse} response 
*/
/*
export async function file(request, response) {
    let filePath = request.url.substring("/file/".length)
    filePath = decodeURI(filePath)

    try {
        fileServer.serveFile(filePath, mime.lookup(filePath))(request, response)
    } catch (error) {
        throw error
    }
}
*/