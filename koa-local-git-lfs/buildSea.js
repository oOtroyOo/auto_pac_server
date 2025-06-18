
import fs from "fs";
import os from "os";
import child_process from 'child_process'
import packageJSON from './package.json' with { "type": "json" }
import config from './sea-config.json' with { "type": "json" }

// sea 单个可执行应用程序 https://nodejs.cn/api/single-executable-applications.html

if (fs.existsSync("dist")) {
    fs.rmSync("dist", { force: true, recursive: true })
}
fs.mkdirSync("dist")
child_process.execSync(`"${process.execPath}" ./node_modules/esbuild/bin/esbuild index.js --outfile=./dist/index.js --bundle --platform=node `)
child_process.execSync(`"${process.execPath}" --experimental-sea-config sea-config.json`)

var exePath
if (os.platform().startsWith("win")) {
    exePath = packageJSON.name + '.exe'
} else {
    exePath = packageJSON.name
}

if (fs.existsSync("bin/" + exePath)) {
    fs.rmSync("bin/" + exePath, { force: true, recursive: true })
}

fs.copyFileSync(process.execPath, "bin/" + exePath)
child_process.execSync(`npx postject bin/${exePath} NODE_SEA_BLOB ${config.output} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`)

fs.rmSync("dist", { force: true, recursive: true })
fs.rmSync("dist", { force: true })
fs.rmSync(config.output, { force: true })