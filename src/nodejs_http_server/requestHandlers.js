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

export function hello(query, response) {
    console.log("Hello World");
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write("Hello World");
    response.end();
}
const ipTest = new RegExp("\\d+\\.\\d+\\.\\d+\\.\\d+")

var pachandle = {};
/**
@param {http.IncomingMessage} request 
@param {http.ServerResponse} response 
*/
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


/**
@param {http.IncomingMessage} request 
@param {http.ServerResponse} response 
*/
export async function wakeup(request, response) {
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

    response.writeHead(code, { "Content-Type": "text/plain" });
    response.write(result);
    response.end();
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
export async function file(request, response) {
    let filePath = request.url.substring("/file/".length)
    filePath = decodeURI(filePath)

    try {
        fileServer.serveFile(filePath, mime.lookup(filePath))(request, response)
    } catch (error) {
        throw error
    }
}