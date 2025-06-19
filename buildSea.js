
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

let esbuildCmd = "src/index.js --outfile=dist/index.js --format=esm --bundle --platform=node"
try {
    child_process.execSync(`esbuild ${esbuildCmd}`)
} catch (error) {
    child_process.execSync(`./node_modules/./bin/esbuild ${esbuildCmd}`)
}

var config = {
    "main": "dist/" + packageJSON.main,
    "output": "dist/" + packageJSON.main.replace(path.extname(packageJSON.main), ".blob"),
    "disableExperimentalSEAWarning": true
}
fs.writeFileSync("dist/sea-config.json", JSON.stringify(config))
child_process.execSync(`"${process.execPath}" --experimental-sea-config dist/sea-config.json`)

var exePath
if (os.platform().startsWith("win")) {
    exePath = packageJSON.name + '.exe'
} else {
    exePath = packageJSON.name
}

if (!fs.existsSync("bin"))
    fs.mkdirSync("bin")
if (fs.existsSync("bin/" + exePath)) {
    fs.rmSync("bin/" + exePath, { force: true, recursive: true })
}
if (fs.existsSync("bin/" + exePath)) {
    fs.rmSync("bin/" + exePath, { force: true })
}

fs.copyFileSync(process.execPath, "bin/" + exePath)
child_process.execSync(`npx postject bin/${exePath} NODE_SEA_BLOB ${config.output} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`)

fs.rmSync("dist", { force: true, recursive: true })
fs.rmSync("dist", { force: true })
fs.rmSync(config.output, { force: true })