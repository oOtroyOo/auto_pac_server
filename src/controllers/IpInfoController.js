import BaseController from './BaseController.js'
import ipaddress from 'ip-address'
import os from 'os';
import ip from 'ip';
import Koa from 'koa';
import { File } from 'buffer';
import fs from 'fs/promises'
import { JSDOM } from 'jsdom';
export default class IpInfoController extends BaseController {

    static localIps = []

    publicV4 = undefined
    publicV6 = undefined
    locationInfo = undefined

    /**
    @param {Koa} app 
    @param {koaRouter} router 
    */
    constructor(app, router) {
        super(app, router)
        this.wait = new Promise(async (resolve, reject) => {
            resolve(await this.myIps())
        }).then((result) => {
            this.wait = undefined
        }, (reason) => {
            console.log(reason)
        })
    }
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        let ipInfo = await this.getInfoByRequest(ctx)
        ctx.body = ipInfo
        await super.request(ctx, next)
    }

    async myIps() {

        if (IpInfoController.localIps.length > 0) {
            return IpInfoController.localIps
        }

        if (this.wait) {
            return await this.wait
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
            if (ip.isV4Format(ctx.request.ip)) {
                querystring = ctx.request.ip
            } else {
                let ipAddress = new ipaddress.Address6(ctx.request.ip)
                if (ipAddress.is4()) {
                    querystring = ipAddress.to4().addressMinusSuffix
                } else {
                    querystring = ipAddress.addressMinusSuffix
                }
            }
        }
        return await this.getInfo(querystring)
    }

    async getInfo(address) {

        let ipAddress
        if (IpInfoController.localIps.some(localAddress => ip.isEqual(address, localAddress.addressMinusSuffix))) {
            if (ip.isV4Format(address)) {
                ipAddress = this.publicV4
            } else {
                ipAddress = this.publicV6
            }
        } else {
            if (ip.isV4Format(address)) {
                ipAddress = new ipaddress.Address4(address)
            } else {
                ipAddress = new ipaddress.Address6(address)
            }
        }
        try {
            const response = await fetch(`https://www.ipshudi.com/${ipAddress.addressMinusSuffix}.htm`)
            const data = await response.text();
            if (data) {
                // const filePath = `./ip_info_${ipAddress.addressMinusSuffix}.html`;
                // try {
                //     await fs.writeFile(filePath, data);
                //     console.log(`IP Address Info saved to ${filePath}`);

                // } catch (writeError) {
                //     console.log(`Error writing IP Address Info to file: ${writeError}`);
                // }
                const dom = new JSDOM(data);
                const document = dom.window.document;
                const table = document.querySelector('.ft table')

                const locationRow = Array.from(table.querySelectorAll('tr')).findIndex(row => {
                    const th = row.querySelector('.th');
                    return th && th.textContent.trim() === '归属地'; document.querySelector("body > div.wrapper > div.container > div:nth-child(1) > div > div.ft > table > tbody > tr:nth-child(2) > td.th")
                });

                if (locationRow) {
                    const locationContent = table.querySelector(`tbody > tr:nth-child(${locationRow + 1}) > td:nth-child(2) > span`).textContent.trim()
                    if (locationContent) {
                        console.log(`${ipAddress.addressMinusSuffix}归属地:${locationContent}`);
                        return locationContent.split(' ')
                    } else {
                        console.log('未找到归属地的第二列内容');
                    }
                } else {
                    console.log('未找到归属地' + ipAddress.addressMinusSuffix);
                }
            }
        } catch (error) {
            console.log('Error fetching ipshudi :' + error);
        }
    }
}