#!/usr/bin/env node
'use strict';
import fetch from 'node-fetch';

import https from 'https';
import path from 'path';
import fs from 'fs';

const GFWLIST_PATH = [
  "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt",
  "https://cdn.staticaly.com/gh/gfwlist/gfwlist/master/gfwlist.txt",
  "https://cdn.jsdelivr.net/gh/gfwlist/gfwlist/gfwlist.txt",
  "https://bitbucket.org/gfwlist/gfwlist/raw/HEAD/gfwlist.txt",
  "https://gitlab.com/gfwlist/gfwlist/raw/master/gfwlist.txt"
];

export default class update_pac {
  async process(target, host) {
    fs.mkdir('./bin', 777, function () { })
    try {
      let domains = await this._getDomains()
      var content = await this._writeFile(domains, target, host);
      console.log(`${target} 文件已更新${domains.length}个域名`);
      return content
    } catch (error) {
      console.log("ERROR", error)
      if (content == null) {
        throw error
      }
    }
  }
  /**
   * https GET 请求
   * @param {string} path File path
   * @returns {Promise<string>}
   */
  async _httpsGet(path) {
    // 5 second timeout:
    let controller = new AbortController()
    console.log("Send: " + path)

    let timeoutId = setTimeout(() => controller.abort(), 5000)
    /** @type {RequestInit} */
    let initOption = {}
    initOption.signal = controller.signal
    // return await fetch(path, initOption).then(response => {
    //   console.log("Get: " + path)
    //   if (response.status < 200 || response.status >= 300) {
    //     throw (new Error('statusCode=' + response.status + " :" + response.statusText));
    //   }
    //   return response.text()
    // })

    let response = await fetch(path, initOption)
    if (response.status < 200 || response.status >= 300) {
      throw (new Error('statusCode=' + response.status + " :" + response.statusText));
    }
    try {
      console.log("Find: " + path)
      let content = await response.text()
      return content
    } catch (error) {
      if (error instanceof AbortError) {
      }
      else {
        console.error(error);
        return undefined
      }
    }
  }

  // 获取域名
  async _getDomains() {
    var error = null;
    var promiseList = GFWLIST_PATH.map(url => this._httpsGet(url));

    var rawData = await Promise.any(promiseList)
      .catch(e => error = e)

    if (rawData == null || error != null) {
      if (error != null) {
        if (error.errors != null && error.errors.length > 0) {
          throw error.errors[error.errors.length - 1]
        }
        throw error
      } else {
        throw rawData
      }
    }

    const compactData = rawData.replace('/\n/g', '');
    const ruleData = Buffer.from(compactData, 'base64').toString();
    const ruleList = ruleData.split('\n');

    const domains = [];
    for (const rule of ruleList) {
      if (rule.startsWith('.')) {
        domains.push(rule.slice(1));
      }
      if (rule.startsWith('||')) {
        domains.push(rule.slice(2));
      }
    }

    // 去重
    const domainSet = new Set(domains);
    console.log(`gfwlist.txt: rules=${ruleList.length}, domains=${domainSet.size}`);
    return Array.from(domainSet);
  }

  /**
   * 写入 pac.js 
   * @param {string[]} domains
   * @param {string} target pac.js 文件路径
   * @param {string} host 
   */
  _writeFile(domains, target, host) {
    const pac = fs.readFileSync('pac/pac.js').toString()
    var content = pac.toString()
    content = content.replace(/\$host\$/g, host,)
    content = content.replace("$domains$", domains.map(d => `"${d}"`).join(','))
    fs.writeFileSync(target, content, 'utf8');
    return content
  }
}
