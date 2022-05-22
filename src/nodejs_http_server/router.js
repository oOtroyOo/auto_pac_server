
export async function route(pathname, request, handle, response) {
    console.log("route for " + pathname);
    if (typeof handle[pathname] === 'function') {
        try {
            await handle[pathname](request, response);
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
