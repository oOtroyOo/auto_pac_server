// https://blog.cloudflare.com/bringing-node-js-http-servers-to-cloudflare-workers/#and-framework-compatibility

import app from './koaServer.js'

import { httpServerHandler } from 'cloudflare:node';

app.listen(8787)
export default httpServerHandler({ port: 8787 });