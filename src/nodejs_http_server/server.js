import http from "http"
import url from "url"
import os from "os"

export default class Server {

    constructor() {

    }
    getIPAdress() {
    return "0.0.0.0"
        var interfaces = os.networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];
            if (devName.indexOf("VMware") > -1
                || devName.indexOf("Virtual") > -1) {
                continue;
            }
            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.address.startsWith('172') && !alias.internal) {
                    console.log(devName + "  " + alias.address)
                    return alias.address;
                }
            }
        }
        return "127.0.0.1";
    }

    start(route, handle) {
        /**
    @param {http.IncomingHttpHeaders} request 
    @param {http.ServerResponse} response 
    */
        function onRequest(request, response) {
            var urlObj = url.parse(request.url);
            var pathname = urlObj.pathname;
            var query = urlObj.query;
            console.log("Request for " + pathname + " received." + " query: " + query);

            route(pathname, request, handle, response);
        }
        if (Server.serverIp == null)
            Server.serverIp = this.getIPAdress();
        http.createServer(onRequest).listen(Server.port);
        console.log("Server has started. http://" + Server.serverIp + ":" + Server.port);
    }
}
Server.serverIp = null
Server.port = 10888
