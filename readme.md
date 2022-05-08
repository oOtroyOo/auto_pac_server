﻿# 使用ES6环境自动pac服务脚本

## PAC模板

  在`pac.js`调整模板文件

## 运行方式

1. 直接运行 auto-pac.exe
2. 安装 nodejs 运行命令如下 

    `node.exe --es-module-specifier-resolution=node index.js --input-type=module`
  - 可以在server.js 调整端口号
  - 使用`node-server.vbs`运行可以隐藏命令窗口

## 开机启动
  可以按照你喜欢的方式添加开机启动，此处不解释了
  - 创建快捷方式到开始菜单/启动
  - 添加注册表项
  - 计划任务

## 设置代理

在系统设置中填pac地址 http://127.0.0.1:10888/pac

## 缓存

每天会在bin目录下生成一个pac缓存，自行决定是否要删除