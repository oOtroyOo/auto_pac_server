import app from './koaServer.js'
import * as proxy from "./proxy.js"
import https from "https"
import tls from 'tls';
import fs from "fs";
import path from 'path';


import koaSslify from 'koa-sslify'

let port = 8880
process.argv.forEach((val, index) => {
    console.log(`${index}: ${val}`);
    if (val.startsWith("--port")) {
        var split = val.indexOf('=')
        if (split > 0) {
            port = parseInt(val.substring(split + 1))
        }
    }
});



if (process.env['FC_CUSTOM_LISTEN_PORT']) {
    port = parseInt(process.env['FC_CUSTOM_LISTEN_PORT'])
}

try {
    const certs = {}

    if (fs.existsSync("cert")) {
        fs.readdirSync("cert").forEach((dir) => {
            const certPath = path.join("cert", dir, 'cert.pem');
            const keyPath = path.join("cert", dir, 'privkey.pem');
            console.log(certPath)
            // Check if both cert.pem and privkey.pem exist in the directory
            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {

                certs[dir] = {
                    cert: fs.readFileSync(certPath),
                    key: fs.readFileSync(keyPath)
                };
            }
        });
    }

    if (Object.keys(certs).length > 0) {
        console.log('USE SSL')
        app.use(koaSslify.default({
            port: port
        }))
        const httpsOptions = {
            SNICallback: (servername, cb) => {
                cb(null, tls.createSecureContext(certs[servername]));
            },
            cert: certs[Object.keys(certs)[0]].cert,
            key: certs[Object.keys(certs)[0]].key
        }
        https.createServer(httpsOptions, app.callback())
            .addListener('connect', proxy._onConnect)
            .listen(port, () => {
                console.log("start " + port)
            });
    } else {
        console.log('NO SSL')
        app.listen(port, () => {
            console.log("start " + port)
        })
            .addListener('connect', proxy._onConnect)
    }
} catch (error) {
    console.log("服务器启动失败 " + error)
}