import BaseController from './BaseController.js';
import os from 'os';
import dns from 'dns/promises';
import Wakeup from 'wakeup';
import findLocalDevices from "local-devices";

import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法

const default_mac = "70-85-C2-CB-E4-B2"


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

export default class WakeupController extends BaseController {
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
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
            await super.request(ctx, next)
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
        await super.request(ctx, next)
    }
}