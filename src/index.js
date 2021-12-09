import Server from "./nodejs_http_server/server.js"
import * as router from "./nodejs_http_server/router.js"
import * as requestHandlers from "./nodejs_http_server/requestHandlers.js"

let handle = {}
handle["/"] = requestHandlers.hello;
Object.keys(requestHandlers).forEach(function (key) {
    handle['/' + key] = requestHandlers[key];
})
let s = new Server();
try {
    s.start(router.route, handle);
} catch (error) {
    console.log(error);
    setTimeout(function () { }, 65535);
}