# 使用ES6环境自动pac服务脚本

  - 自动从[gfwlist](https://github.com/gfwlist/gfwlist)官方配置文件解析地址，生成pac文件
  - 使用nodejs作为服务器，兼容ES6语言
  - 支持自定义代理名单，白名单

## PAC模板

  在`pac.js`调整模板文件

## 可选运行方式

### 下载运行软件 exe 
  下载链接：[![Build status](https://ci.appveyor.com/api/projects/status/vm7a0xamm0t7manv?svg=true&retina=true)](https://ci.appveyor.com/project/oOtroyOo/auto-pac-server/build/artifacts) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/oOtroyOo/auto_pac_server)](https://github.com/oOtroyOo/auto_pac_server/releases/latest)
### 安装 nodejs 运行命令如下 
  ```
  node.exe --es-module-specifier-resolution=node index.js --input-type=module
  ```
    
- 可以在server.js 调整端口号
- 使用node-server.vbs运行可以隐藏命令窗口
- 在`update_pac.js`中配置了几条pac文件下载地址，以解决外往访问慢的问题

## 开机启动
  可以按照你喜欢的方式添加开机启动，此处不解释了
  - 创建快捷方式到开始菜单/启动
  - 添加注册表项
  - 计划任务

## 设置代理

在系统设置中填pac地址 http://127.0.0.1:10888/pac

## 缓存

每天会在bin目录下刷新一次pac文件做缓存，自行决定是否要删除

## 网络唤醒

`http://127.0.0.1:10888/wakeup?XX-XX-XX-XX-XX-XX`
唤醒局域网中Mac地址的电脑

## Developer

Build 时，执行文件例如 fetched-v**.**.*-win-x64  下载缓慢的话，前往 [pkg下载](https://github.com/vercel/pkg-fetch/releases)，直接改名成`fetched-v**.**.*-win-x64`文件复制到 `C:\Users\[用户]\.pkg-cache\v3.3`
