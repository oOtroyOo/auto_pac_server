#!/usr/bin/env node

'use strict';

import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

const GFWLIST_PATH = "https://cdn.jsdelivr.net/gh/gfwlist/gfwlist@master/gfwlist.txt";


/**
 * https GET 请求
 * @param {string} path File path
 * @returns {Promise<string>}
 */
function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(path, { timeout: 30 * 1000 });
    req.on('response', res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error('statusCode=' + res.statusCode));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', err => reject(err));
  });
}

// 获取域名
export async function getDomains() {
  const rawData = await httpsGet(GFWLIST_PATH);
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
export async function writeFile(domains, target, host) {
  const pac = fs.readFileSync('pac/pac.js').toString()
  var content = pac.toString()
  content = content.replace(/\$host\$/g, host,)
  content = content.replace("$domains$", domains.map(d => `"${d}"`).join(','))
  fs.writeFileSync(target, content, 'utf8');
  return content
}