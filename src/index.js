import Server from "./nodejs_http_server/server.js"
import * as router from "./nodejs_http_server/router.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"

let handle = {}
handle["/"] = requestHandlers.hello;
Object.keys(requestHandlers).forEach(function (key) {
    handle['/' + key] = requestHandlers[key];
})

process.argv.forEach((val, index) => {
    console.log(`${index}: ${val}`);
    if (val.startsWith("--port")) {
        var split = val.indexOf('=')
        if (split > 0) {
            var port = parseInt(val.substring(split + 1))
            Server.port = port
        }
    }
});

let s = new Server();
try {
    s.start(router.route, handle);
} catch (error) {
    console.log(error);
    setTimeout(function () { }, 65535);
}