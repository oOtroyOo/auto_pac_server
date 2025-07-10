import BaseController from './BaseController.js'
import Koa from 'koa';
// import QuickConnect from 'quickconnectid'
import axios, { } from 'axios';
import { URL } from 'url';


const urlMap = {}
const httpProxy = null // { host: "localhost", port: 8888, protocol: "http" }
const requestQueue = [];
const defaultHeaders = {
    Connection: 'keep-alive',
    'sec-ch-ua-platform': '"Windows"',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

export default class QCController extends BaseController {

    init() {
        // super.init()
        this.router.all('/qc/:id', async (ctx, next) => await this.request(ctx, next))
        this.router.all('/qc/:id/*path', async (ctx, next) => await this.request(ctx, next))
    }
    /**
     * @param {Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, string>} ctx 
     * @param {Koa.Next} next 
     */
    async request(ctx, next) {
        const self = this
        let quickConnectID = ctx.params.id
        if (urlMap[quickConnectID] == null) {
            let serveUrl = await determineServerURL(quickConnectID)
            if (serveUrl != null) {
                urlMap[quickConnectID] = serveUrl
            }
        }

        if (urlMap[quickConnectID] != null) {
            let hostUrl = URL.parse(urlMap[quickConnectID])
            let resultUrl = hostUrl.protocol + "//" + hostUrl.host + ctx.url.substring(this.router.opts.prefix.length + '/qc/'.length + quickConnectID.length)
            ctx.status = 308
            ctx.response.set("Location", resultUrl)

        }

        await super.request(ctx, next)
    }
}


async function determineServerURL(id) {
    let quickConnectID = id;
    let response = await getServerData(quickConnectID)
    if (response[0].server && response[0].service) {
        let tunnelResponse = await createTunnelRequests(quickConnectID, response[0])
        if (tunnelResponse) {
            createCallRelayRequests(tunnelResponse);
        }

        createCallDSMDirectlyRequests(response[0]);
        createCallRelayRequests(response[0]);


        if (response[0].env) {
            // https://sy-troy.cn4.quickconnect.cn/webman/pingpong.cgi?action=cors&quickconnect=true
            if (response[0].env.relay_region) {
                const callUrl = `http://${quickConnectID}.${response[0].env.relay_region}.quickconnect.cn/webman/pingpong.cgi?action=cors&quickconnect=true`;
                if (requestQueue.indexOf(callUrl) < 0)
                    requestQueue.push(callUrl);
            }
        }
        let url = await processRequestQueue()

        return url
    }

}

async function processRequestQueue() {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // for (const url of requestQueue) {

    //     try {
    //         console.log("ping " + url)
    //         let response = await axios.get(url, { timeout: 2000, headers: defaultHeaders });
    //         if (response.data.success) {
    //             return url
    //         }
    //     } catch (e) {
    //         console.error(e.message);
    //     }

    // }
    /**
* @type {Promise<any>[]}
*/
    var list = requestQueue.map(async (url) => {
        console.log("ping " + url)

        let response = await axios.get(url, { timeout: 2000, headers: defaultHeaders, signal: signal });
        if (response.data.success) {
            abortController.abort()
            return url
        }
    })
    for (let index = 0; index < list.length; index++) {
        list[index].catch(e => {
            console.error(e.message)
        })
    }

    Promise.allSettled(list).then(() => {
        abortController.abort()
    })
    while (!signal.aborted) {
        try {
            return Promise.any(list)
        } catch (error) {
            console.error(error.message)
        }
        if (signal.aborted) {
            break;
        }
    }
    return null;
}

async function getServerData(quickConnectID) {
    var serverRequestData = [
        // {
        //     "version": 1,
        //     "command": "get_server_info",
        //     "stop_when_error": "false",
        //     "stop_when_success": "false",
        //     "id": "dsm_portal_https",
        //     "serverID": quickConnectID
        // },
        {
            "version": 1,
            "command": "get_server_info",
            "stop_when_error": "false",
            "stop_when_success": "false",
            "id": "dsm_portal",
            "serverID": quickConnectID
        }
    ];

    let headers = {
        'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
    }
    for (let k in defaultHeaders) {
        headers[k] = defaultHeaders[k];
    }

    let response = await axios.post('http://global.quickconnect.cn/Serv.php', JSON.stringify(serverRequestData), {
        headers: headers,
        proxy: httpProxy
    });

    return response.data;
}

async function createTunnelRequests(quickConnectID, serverData) {
    if (serverData.env.control_host) {
        var serverRequestData = {
            "command": "request_tunnel",
            "version": 1,
            "serverID": quickConnectID,
            "id": "dsm_portal"
        }


        let headers = {
            // 'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
        }
        for (let k in defaultHeaders) {
            headers[k] = defaultHeaders[k];
        }

        let response = await axios.post('http://' + serverData.env.control_host + '/Serv.php', JSON.stringify(serverRequestData), {
            headers: headers,
            proxy: httpProxy
        });

        return response.data;
    } else {
        throw "serverData.env.control_host == null"
    }
}

function createCallRelayRequests(serverData) {
    var relayIp = serverData.service.relay_ip;
    var relayPort = serverData.service.relay_port;
    var relayRegion = serverData.env.relay_region;

    if (relayIp) {
        createPingPongCall(relayIp, relayPort);
    }

    if (serverData.server) {
        const callUrl = `https://${serverData.server.ddns}${serverData.server.pingpong_path}`;
        if (requestQueue.indexOf(callUrl) < 0)
            requestQueue.push(callUrl);
    }

    if (serverData.smartdns) {
        if (serverData.smartdns.host) {
            const callUrl = `http://${serverData.smartdns.host}/webman/pingpong.cgi?action=cors`;
            if (requestQueue.indexOf(callUrl) < 0)
                requestQueue.push(callUrl);
        }

        if (serverData.smartdns.lan) {
            for (const host of serverData.smartdns.lan) {
                const callUrl = `http://${host}/webman/pingpong.cgi?action=cors`;
                if (requestQueue.indexOf(callUrl) < 0)
                    requestQueue.push(callUrl);
            }
        }

        if (serverData.smartdns.lanv6) {
            for (const host of serverData.smartdns.lanv6) {
                const callUrl = `http://${host}/webman/pingpong.cgi?action=cors&quickconnect=true`;
                if (requestQueue.indexOf(callUrl) < 0)
                    requestQueue.push(callUrl);
            }
        }
    }
}


function createCallDSMDirectlyRequests(serverData) {
    var port = serverData.service.port;
    var externalPort = serverData.service.ext_port;

    if (serverData.server.interface) {
        for (var i = 0; i < serverData.server.interface.length; i++) {
            var serverInterface = serverData.server.interface[i];

            if (serverInterface.ip) {
                createPingPongCall(serverInterface.ip, port);
            }

            if (serverInterface.ipv6 && serverInterface.ipv6.length > 0) {
                for (var j = 0; j < serverInterface.ipv6.length; j++) {
                    var ipv6 = serverInterface.ipv6[i];
                    createPingPongCall('[' + ipv6.address + ']', port);
                }
            }
        }
    }
}

function createPingPongCall(ip, port) {
    var callUrl = 'http://' + ip + (port ? ":" + port : "") + "/webman/pingpong.cgi?action=cors";
    if (requestQueue.indexOf(callUrl) < 0)
        requestQueue.push(callUrl);
}