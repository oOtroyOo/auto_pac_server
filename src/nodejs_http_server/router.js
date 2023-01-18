
/**
 * 
 * @param {string} pathname 
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response 
 * @param {Map<string,function(http.IncomingMessage,http.ServerResponse)>} handle 
 */
export async function route(pathname, request, handle, response) {
    console.log("route for " + pathname);
    let handleName = pathname

    let index = pathname.indexOf("/", 1)
    if (index > -1) {
        handleName = pathname.substring(0, index);
    }

    if (handle[handleName]!=null && typeof handle[handleName] === 'function') {
        try {
            await handle[handleName](request, response);
        } catch (error) {

            console.log("ERROR", error)
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write(error.message + "\n" + error.stack);
            response.end();
        }
    } else {
        console.log("No request handler found for " + pathname);
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.write("404 not found");
        response.end();
    }
}
