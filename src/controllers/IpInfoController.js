import BaseController from './BaseController.js'
import ipaddress from 'ip-address'
import os from 'os';
import ip from 'ip';
import Koa from 'koa';
import fs from 'fs/promises'
import { JSDOM } from 'jsdom';
import { log } from 'console';
import {
    setTimeout,
    setImmediate,
    setInterval,
} from 'timers/promises'; // 默认常用计时方法替换成Async方法
export default class IpInfoController extends BaseController {

    static localIps = []

    publicV4 = undefined
    publicV6 = undefined
    locationInfo = undefined

    init() {
        super.init()

        this.wait = new Promise(async (resolve, reject) => {
            resolve(await this.myIps())
        }).then((result) => this.wait = undefined)
    }

    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        if (this.wait) {
            await this.wait
        }
        let ipInfo = await this.getInfoByRequest(ctx)
        ctx.body = ipInfo
        await super.request(ctx, next)
    }

    async myIps() {
        if (this.wait) {
            return await this.wait
        }
        await setTimeout(1)
        if (IpInfoController.localIps.length > 0) {
            return IpInfoController.localIps
        }

        IpInfoController.localIps.push(new ipaddress.Address4('127.0.0.1/8'))
        IpInfoController.localIps.push(new ipaddress.Address4('0.0.0.1/32'))
        IpInfoController.localIps.push(new ipaddress.Address6('::1/128'))
        var interfaces = os.networkInterfaces();
        for (const devName in interfaces) {
            if (devName == undefined || devName.indexOf("Virtural") > -1 || devName.indexOf("VMware") > -1 || devName.indexOf("vEther") > -1) {
                continue
            }

            let iface = interfaces[devName];

            for (const alias of iface) {
                let address
                if (alias.family === 'IPv4') {
                    address = new ipaddress.Address4(alias.cidr);
                }
                else if (alias.family === 'IPv6') {
                    address = new ipaddress.Address6(alias.cidr);
                }
                if (address) {
                    if (!IpInfoController.localIps.some(localAddress => ip.isEqual(address.addressMinusSuffix, localAddress.addressMinusSuffix))) {
                        IpInfoController.localIps.push(address);
                    }
                }
            }
        }

        // Perform an HTTP GET request to fetch additional IP information
        try {
            const response = await fetch('https://4.ipw.cn');
            const data = await response.text();
            if (data) {
                this.publicV4 = new ipaddress.Address4(data);
                IpInfoController.localIps.push(this.publicV4);
                // this.locationInfo = await this.getInfo(this.publicV4.addressMinusSuffix)
            }
        } catch (error) {
            console.log('Error fetching external IPV4:' + error);
        }

        try {
            const response = await fetch('https://6.ipw.cn');
            const data = await response.text();
            if (data) {
                this.publicV6 = new ipaddress.Address6(data);
                IpInfoController.localIps.push(this.publicV6);
                // this.locationInfo = await this.getInfo(this.publicV6.addressMinusSuffix)
            }
        } catch (error) {
            console.log('Error fetching external IPV6:' + error);
        }
        this.wait = undefined
        return IpInfoController.localIps
    }
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     */
    async getInfoByRequest(ctx) {
        let querystring = ctx.querystring
        if (!querystring) {
            querystring = ctx.request.ip
            // 如果使用了代理，那么可以通过以下方式获取真实 IP
            const xForwardedFor = ctx.request.header['x-forwarded-for'];
            if (xForwardedFor) {
                querystring = xForwardedFor.split(',')[0];
            }

            if (!ip.isV4Format(querystring)) {
                let ipAddress = new ipaddress.Address6(querystring)
                if (ipAddress.is4()) {
                    querystring = ipAddress.to4().addressMinusSuffix
                } else {
                    querystring = ipAddress.addressMinusSuffix
                }
            }
        }
        console.log('querystring = ' + querystring)
        let result = await this.getInfo(querystring)
        if (result) {
            return result
        }
        ctx.status = 403
        return ""
    }

    async getInfo(requestIp) {

        if (this.wait) {
            await this.wait
        }

        let ipAddress
        if (ip.isV4Format(requestIp)) {
            ipAddress = new ipaddress.Address4(requestIp)
        } else {
            ipAddress = new ipaddress.Address6(requestIp)
        }
        if (ipAddress.addressMinusSuffix.startsWith("192.168")
            || ipAddress.addressMinusSuffix === "127.0.0.1"
            || ipAddress.addressMinusSuffix === "0.0.0.1"
            || IpInfoController.localIps.some(addr => {
                return ip.isEqual(ipAddress.addressMinusSuffix, addr.addressMinusSuffix)
                    || ipAddress.mask(addr.subnetMask) === addr.mask(addr.subnetMask)
            })) {
            console.log("Find is local IP")
            if (ip.isV4Format(requestIp) || !this.publicV6) {
                ipAddress = this.publicV4
            } else {
                ipAddress = this.publicV6
            }
        }
        console.log(ipAddress)

        let functions = [
            this.ipshudi,
            this.useragentinfo,
            this.openbaidu
        ]

        for (const fun of functions) {
            let result = await fun(ipAddress)
            if (result) {
                return result
            }
        }

        return undefined
    }

    async ipshudi(ipAddress) {
        try {
            let url = 'https://www.ipshudi.com/' + ipAddress.addressMinusSuffix + '.htm'
            const response = await fetch(url)
            console.log(response.status + " : " + url)
            const data = await response.text();
            if (data) {
                console.log(data + "\n\n")
                // const filePath = `./ip_info_${ipAddress.addressMinusSuffix}.html`;
                // try {
                //     await fs.writeFile(filePath, data);
                //     console.log(`IP Address Info saved to ${filePath}`);

                // } catch (writeError) {
                //     console.log(`Error writing IP Address Info to file: ${writeError}`);
                // }
                const dom = new JSDOM(data);
                const document = dom.window.document;
                const tbody = document.querySelector('.ft table tbody')
                if (tbody) {
                    console.log(tbody.outerHTML + "\n\n")
                    const locationRow = Array.from(tbody.querySelectorAll('tr')).findIndex(row => {
                        const th = row.querySelector('.th');
                        return th && th.textContent.trim() === '归属地';
                    });

                    if (locationRow) {
                        const span = tbody.querySelector(`tbody > tr:nth-child(${locationRow + 1}) > td:nth-child(2) > span`)
                        if (span) {
                            console.log(span.outerHTML + "\n\n")
                            const locationContent = span.textContent.trim()
                            if (locationContent) {
                                console.log(`${ipAddress.addressMinusSuffix}归属地:${locationContent}`);
                                return locationContent.split(' ')
                            }
                        }
                        console.log('未找到归属地的第二列内容');
                    }
                }
                console.log('未找到归属地' + ipAddress.addressMinusSuffix);
            }
        } catch (error) {
            console.error('Error fetching ipshudi', error);
            // throw error
        }
    }

    async openbaidu(ipAddress) {
        try {
            let url = `https://opendata.baidu.com/api.php?query=${ipAddress.addressMinusSuffix}&co=&resource_id=6006&oe=utf8`
            const response = await fetch(url)
            console.log(response.status + " : " + url)
            const json = await response.json();
            console.log(json)
            if (json && json['data']) {
                const element = json['data'][0]
                return [element.location.split(' ')[0]]
            }
            console.log('未找到归属地' + ipAddress.addressMinusSuffix);
        } catch (error) {
            console.error('Error fetching openbaidu', error);
        }
    }

    async useragentinfo(ipAddress) {
        try {
            let url = `https://ip.useragentinfo.com/jsonp?ip=${ipAddress.addressMinusSuffix}`
            const response = await fetch(url)
            console.log(response.status + " : " + url)
            const data = await response.text()
            if (data) {
                let json = undefined
                let callback = function (args) {
                    json = args
                }
                eval(data)
                console.log(json)
                if (json) {
                    return [json.country, json.province, json.city]
                }
            }

            console.log('未找到归属地' + ipAddress.addressMinusSuffix);
        } catch (error) {
            console.error('Error fetching useragentinfo', error);
        }
    }
}