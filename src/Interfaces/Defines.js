import Koa from 'koa';

/**
 * @typedef {Object} MyConfig
 * @property {RegExp[]} NeedProxyUrl
 * @property {Array<[RegExp, string]>} RefererMap
 * @property {string[]} pixivCdn
 * @property {string} proxyUrl
 * @property {Promise<string>} pixivCdnHost
 */

/**
 * @typedef {Koa & { MyConfig: MyConfig }} KoaWithMyInterface
 */
export class KoaWithMyInterface extends Koa {
    /** @type {MyConfig} */
    MyConfig;
}