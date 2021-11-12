import * as server from "./nodejs_http_server/server"
import * as router from "./nodejs_http_server/router"
import * as requestHandlers from "./nodejs_http_server/requestHandlers"

let handle = {}
handle["/"] = requestHandlers.hello;
Object.keys(requestHandlers).forEach(function (key) {
    handle['/' + key] = requestHandlers[key];
})

server.start(router.route, handle);