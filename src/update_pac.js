#!/usr/bin/env node
import fetch from 'node-fetch';
'use strict';

import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

const GFWLIST_PATH = [
  "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt",
  "https://cdn.jsdelivr.net/gh/gfwlist/gfwlist@master/gfwlist.txt",
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
    var controller = new AbortController()
    console.log("Send: " + path)

    var timeoutId = setTimeout(() => controller.abort(), 5000)
    /** @type {RequestInit} */
    var initOption = {}
    initOption.signal = controller.signal
    return await fetch(path, initOption).then(response => {
      console.log("Get: " + path)
      if (response.status < 200 || response.status >= 300) {
        throw (new Error('statusCode=' + response.status + " :" + response.statusText));
      }
      return response.text()
    })

    // Promise封装异步
    // return new Promise((resolve, reject) => {
    //   /**@type {https.RequestOptions} */
    //   var options = {}
    //   options.timeout = 3;
    //   options.sessionTimeout = 3;
    //   const req = https.get(path, options);
    //   req.on('response', res => {
    //     if (res.statusCode < 200 || res.statusCode >= 300) {
    //       return reject(new Error('statusCode=' + res.statusCode));
    //     }
    //     const chunks = [];
    //     res.on('data', chunk => chunks.push(chunk));
    //     res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    //   });
    //   req.on('error', err => reject(err));
    // });

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