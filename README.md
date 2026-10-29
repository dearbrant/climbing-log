# 岩记 · Climbing Log

手机优先的个人绳索攀岩日志，支持岩馆与野外的先锋、顶绳及自动保护器，不含抱石。纯静态 HTML、CSS 与 JavaScript，无运行时第三方依赖，不需要登录或服务器数据库。

## 目录与运行

项目目录：`/Users/brant/Documents/Project/climbing-log`。

- `docs/`：网页源码，同时为 GitHub Pages 发布目录。
- `tests/`：记录规则与备份校验测试。

需要 Node.js 22 或更新版本运行测试，Python 3 用于本地预览：

```sh
npm test
npm run check
npm run dev
```

打开 `http://127.0.0.1:4173/`。请通过 HTTP/HTTPS 访问，不要直接双击 HTML 文件。

## 使用

1. 点击“记录”，填写日期、地点、攀爬方式、难度和结束状态。难度允许未知。
2. 线路特征、七色单选、体感、照片、长度、定线员、保护员和备注为选填。
3. Send 表示无坠落、无挂绳休息地从起点到终点完成；其他情况记 Attempt。仅 Send 需要完攀类型。
4. 每次上墙单独记录，包含成功的那一次。已有线路可用“再爬一次”复用，历史按方式分别统计。
5. Project 设置目标攀爬方式。目标方式的 Send 自动完成 Project，也可手动调整进行中、已完成和已停止。
6. 进入“数据”导出完整 JSON 备份，包含日志、线路、Project 与保存后的全部照片。换设备时打开同一工具后导入。

先锋类型采用产品约定：首次无动作信息完成为 Onsight，首次已有动作信息完成为 Flash，练习后的首次先锋成功为 Redpoint，后续先锋成功为 Repeat。顶绳与自动保护器使用首次无坠落完成、练习后无坠落完成和重复完成。类型由使用者选择，系统不会根据不完整的日志强制推断。

## 本机数据与照片

数据存储于当前浏览器当前源的 IndexedDB（数据库 `climbing-log-v1`）。不会上传 GitHub 或其他服务器。不同浏览器、设备和源（协议、主机、端口）不共享数据；同源的不同路径并非安全隔离边界。部署后应固定使用最终 HTTPS 地址，避免在不同域名之间切换。

无痕模式、清除网站数据和浏览器回收存储可能导致记录丢失。持久存储申请由浏览器决定，不能替代备份。导出后需自行确认文件已保存。备份未加密，请自行妥善保管。

每条线路最多 4 张照片，单张原文件不超过 30 MB，浏览器解码后压缩为最长边 1600 像素、质量 0.82 的 JPEG。备份保留的是保存后的照片，不是原图。支持格式取决于浏览器；HEIC 无法解码时请改用 JPEG。网页没有离线缓存功能，首次打开与刷新页面需要网络。

导入在写入前检查格式、版本、字段、重复标识和线路关联。采用原子事务合并；同一 ID 的本机记录优先保留。重复导入同一备份不会新增重复记录。首版导入上限 200 MB，较大照片库导出导入会占用设备内存。

线路是共享资料，修改颜色、难度、特征、长度或照片后，对应历史日志会一起更新。岩馆换线后请新建线路。删除日志不删除线路或照片，也不自动撤销 Project 完成状态；可在 Project 页调整。计数仅代表已录入次数。

## GitHub Pages

仓库：`dearbrant/climbing-log`。

Pages 配置：Deploy from a branch，`main` 分支，`/docs` 目录。无需自定义 Actions 工作流、构建过程或付费服务。

HTML 静态声明 `<meta name="robots" content="noindex">`。不使用 robots.txt 禁止抓取，以使搜索引擎可以读取 noindex。不收录要求不是访问权限控制，程序页面仍公开可访问。个人数据与备份不放入仓库。

Git 提交身份只在本项目配置：`dearbrant`，`4136121+dearbrant@users.noreply.github.com`。不修改全局 Git 身份，推送前须通过 `gh api user` 验证账号。

## 参考资料

- [theCrag：完攀类型](https://www.thecrag.com/article/ticktypes)
- [MDN：IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [GitHub Pages：配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Google：使用 noindex 阻止索引](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
