# Climbing Log

手机优先的个人绳索攀岩日志，目前默认室内岩馆的 Auto Belay、Top Rope、Lead，不含抱石。网页使用纯 HTML、CSS、JavaScript 和浏览器本机 IndexedDB。

## 项目与运行

项目目录：`/Users/brant/Documents/Project/climbing-log`。网页源码位于 `docs/`，同时是 GitHub Pages 的发布目录。

```sh
npm test
npm run check
npm run dev
```

本地访问 `http://127.0.0.1:4173/`。

## 当前界面

- Home 按攀爬日期分组，所有日期的卡片默认展示。组内卡片按最近更新时间排序，日期右侧显示记录数。同一天可记录多条相同难度线路，每条记录以独立 ID 保存。
- 点击卡片直接进入可编辑的 Climb Detail。Update Climb 保存修改，Delete 删除记录；有未保存的修改时关闭会提示确认。Project 标签打开 Project List。
- Log A Climb 默认今天、Mellow、Auto Belay、Black Line、5.10d、Feel Moderate、Redpoint、Not a Project。
- 难度选择范围为 5.10a 至 5.15d，包括 5.10ab、5.10bc、5.10cd 等过渡等级。日期、难度和颜色使用浏览器原生控件，在 iOS Safari 上使用系统选择界面。
- 结果选项为 Onsight、Flash、Redpoint、Repeat 和 Attempt。前四项记录为 Send，Attempt 表示未成功。
- 表单只展示当前值，不显示字段标题。岩馆使用原生选择列表，顺序与设计稿 Section 1 一致。Scene 与 More details 暂不显示；编辑旧记录时会保留相关历史数据。
- Home 标题右侧的设置图标打开 Data Sync。Export Data 导出 JSON 备份，Import Backup 合并备份记录；本机已有的同 ID 记录优先保留。

本机存储继续用于保存记录。照片和存储管理的界面入口暂时隐藏；原有照片数据仍保留。旧记录使用原有字段读取，编辑后会记录新的更新时间。

## 数据与发布

数据只保存在当前浏览器当前源的 IndexedDB 中，不会上传 GitHub。清除网站数据可能导致记录丢失。可从 Data Sync 导出备份文件，并在其他浏览器或设备的同一网页导入。

仓库：`dearbrant/climbing-log`。GitHub Pages 使用 `main` 分支的 `/docs` 目录。页面声明 `noindex,nofollow`，但网址仍可公开访问。

提交身份只在本仓库配置为 `dearbrant`。推送前核对当前 GitHub 凭据与账号。

## 字体与图标

标题和难度数字使用 LogoSC Unbounded Sans，其他英文界面文字使用 Google Sans Flex。网页自托管拉丁字符 WOFF2 文件，中文回退至设备系统字体。两款字体均采用 SIL Open Font License 1.1，授权文件位于 `docs/fonts/`。

界面使用用户提供的 Solar SVG 图标文件，存放在 `docs/icons/`。来源与授权署名见 `docs/ICON_CREDITS.md`。
