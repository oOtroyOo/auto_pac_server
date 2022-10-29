import * as http from "http"
import * as url from "url"
import * as os from "os"
import * as net from "net";


export default class Server {

    constructor() {

    }



    start(route, handle) {
        function _getHostPortFromString(hostString, defaultPort) {
            var host = hostString;
            var port = defaultPort;

            var result = regex_hostport.exec(hostString);
            if (result != null) {
                host = result[1];
                if (result[2] != null) {
                    port = result[3];
                }
            }

            return ([host, port]);
        };


        /**
        @param {http.IncomingMessage} request 
        @param {http.ServerResponse} response 
        */
        function _onRequest(request, response) {
            var urlObj = url.parse(request.url);
            var pathname = urlObj.pathname;
            var query = urlObj.query;
            console.log("Request for " + pathname + " received." + " query: " + query);

            route(pathname, request, handle, response);
        }

        //https://stackoverflow.com/questions/8165570/https-proxy-server-in-node-js
        var regex_hostport = /^([^:]+)(:([0-9]+))?$/;
        function _onConnect(req, socket, bodyhead) {
            var hostPort = _getHostPortFromString(req.url, 443);
            var hostDomain = hostPort[0];
            var port = parseInt(hostPort[1]);
            console.log("Proxying HTTPS request for:", hostDomain, port);

            var proxySocket = new net.Socket();
            proxySocket.connect(port, hostDomain, function () {
                proxySocket.write(bodyhead);
                socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
            }
            );

            proxySocket.on('data', function (chunk) {
                socket.write(chunk);
            });

            proxySocket.on('end', function () {
                socket.end();
            });

            proxySocket.on('error', function () {
                socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
                socket.end();
            });

            socket.on('data', function (chunk) {
                proxySocket.write(chunk);
            });

            socket.on('end', function () {
                proxySocket.end();
            });

            socket.on('error', function () {
                proxySocket.end();
            });
        }

        var server = http.createServer(_onRequest)
        server.addListener('connect', _onConnect)
        server.listen(Server.port, function () {
            console.log("Server has started. http://" + server.address().address + ":" + server.address().port);
        });
    }
}
Server.port = 8880
