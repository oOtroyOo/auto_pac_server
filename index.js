import Test from "./Test";
new Test().print();
import * as server from "./nodejs_http_server/server"
import * as router from "./nodejs_http_server/router"
import * as requestHandlers from "./nodejs_http_server/requestHandlers"

let handle = {}
handle["/"] = requestHandlers.hello;
Object.keys(requestHandlers).forEach(function (key) {
    handle['/' + key] = requestHandlers[key];
})
// handle["/get"] = requestHandlers.get;

server.start(router.route, handle);