import http from "http"
import url from "url"
const port = 6633
export function start(route, handle) {
    function onRequest(request, response) {
        var urlObj = url.parse(request.url);
        var pathname = urlObj.pathname;
        var query = urlObj.query;
        console.log("Request for " + pathname + " received." + " query: " + query);

        route(pathname, query, handle, response);
    }

    http.createServer(onRequest).listen(port);
    console.log("Server has started. http://127.0.0.1:" + port);
}

