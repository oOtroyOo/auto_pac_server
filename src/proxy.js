import * as net from "net";
import fs from "fs";
import vm from "vm"; // Import vm to run the script

var regex_hostport = /^([^:]+)(:([0-9]+))?$/;


//https://stackoverflow.com/questions/8165570/https-proxy-server-in-node-js

export async function _onConnect(req, socket, bodyhead) {
    var hostPort = _getHostPortFromString(req.url, 443);
    var hostDomain = hostPort[0];
    var port = parseInt(hostPort[1]);
    console.log("Proxying HTTPS request for:", hostDomain, port);

    // Read and load the PAC script
    const pacScript = fs.readFileSync("./bin/pac_127.0.0.1.js", "utf8");
    const script = new vm.Script(pacScript);
    const sandbox = {
        FindProxyForURL: null,
        dnsDomainIs: function (host, domain) {
            if (domain.startsWith("*.")) {
                domain = domain.substring(2);
                return host.endsWith(domain) && (host.length === domain.length || host.charAt(host.length - domain.length - 1) === '.');
            } else if (host.endsWith(domain)) {
                return true
            }
            return host === domain;
        }
    };
    script.runInNewContext(sandbox);
    const FindProxyForURL = sandbox.FindProxyForURL;

    // Check if the request host address is a valid proxy server
    var proxy = FindProxyForURL(req.url, hostDomain);
    if (proxy && proxy.startsWith("SOCKS5")) {

    }

    var proxySocket = new net.Socket();
    proxySocket.connect(port, hostDomain, function () {
        proxySocket.write(bodyhead);
        socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    });

    proxySocket.on('data', function (chunk) {
        socket.write(chunk);
    });

    proxySocket.on('end', function () {
        socket.end();
    });

    proxySocket.on('error', function (err) {
        console.error("Proxy socket error:", err);
        socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
        socket.end();
    });

    socket.on('data', function (chunk) {
        proxySocket.write(chunk);
    });

    socket.on('end', function () {
        proxySocket.end();
    });

    socket.on('error', function (err) {
        console.error("Client socket error:", err);
        proxySocket.end();
    });
}


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
