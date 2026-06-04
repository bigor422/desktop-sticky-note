# Desktop Sticky Note

一个基于 Electron 的桌面便签 / 待办应用，支持置顶显示、透明度调节、浅色 / 深色主题、任务勾选和本地自动保存。

## 功能

- 桌面悬浮便签窗口
- 待办事项新增、完成、删除
- 自动保存本地数据
- 窗口置顶开关
- 浅色 / 深色主题切换
- 透明度调节
- 系统托盘显示 / 隐藏

## 本地运行

```bash
npm install
npm start
```

## 打包

```bash
npm run build
```

生成安装包：

```bash
npm run installer
```

## 数据存储

开发环境的数据保存在 `.user-data/`，打包后保存在程序目录下的 `user-data/`。这些目录包含个人便签内容，已经被 `.gitignore` 排除，不应提交到公开仓库。

## 许可证

暂未指定许可证。公开发布前可以按需要添加 `LICENSE` 文件。
