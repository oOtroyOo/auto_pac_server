
import fs from "fs";
import os from "os";
import path from "path";
import child_process from 'child_process'
import packageJSON from './package.json' with { "type": "json" }

// sea 单个可执行应用程序 _ Node.js v22 文档.html https://nodejs.cn/api/single-executable-applications.html
// Node.js 新特性 SEA_单文件可执行应用尝鲜_nodejs sea-CSDN博客.html https://blog.csdn.net/ssrc0604hx/article/details/133776379


if (fs.existsSync("dist")) {
    fs.rmSync("dist", { force: true, recursive: true })
}
fs.mkdirSync("dist")
fs.copyFileSync('./package.json', "dist/package.json")

var config = {
    "main": "src/" + packageJSON.main,
    "output": "dist/" + packageJSON.main.replace(path.extname(packageJSON.main), ".blob")
}
fs.writeFileSync("dist/sea-config.json", JSON.stringify(config))

var exePath
if (os.platform().startsWith("win")) {
    exePath = "dist/" + packageJSON.name + '.exe'
} else {
    exePath = "dist/" + packageJSON.name
}
fs.copyFileSync(process.execPath, exePath)
child_process.exec(process.execPath + " --experimental-sea-config dist/sea-config.json")
child_process.exec(`npx postject ${exePath} NODE_SEA_BLOB ${config.output} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`)