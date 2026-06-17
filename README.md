# Personal Works Studio

一个可编辑的个人作品分享站，适合展示音乐、摄影、设计、IP 形象与延伸、视频和个人爱好内容。前台是带光标互动动效的作品档案页，后台 Studio 可以维护页面框架、主题、栏目结构、作品条目和上传文件。

## 功能

- 前台作品展示：按音乐、摄影、设计、IP、视频、爱好分类筛选。
- 媒体上传：支持图片、音频、视频、PDF、压缩包等文件，前台提供下载入口。
- 独立后台：访问 `/admin`，用管理口令保存内容。
- 框架编辑：可调整站点标题、主视觉文案、主题色、栏目顺序、栏目可见性、灵感拼贴和过程记录开关。
- 高级 JSON：可直接编辑完整内容结构，适合扩展自定义模块。
- 本地持久化：内容保存在 `data/site.json`，上传文件保存在 `data/uploads/`，每次保存会在 `data/backups/` 生成备份。

## 快速开始

```bash
npm install
npm start
```

打开：

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>

默认后台口令是 `studio-admin`。部署时请设置环境变量：

```bash
ADMIN_TOKEN="replace-with-a-strong-token" npm start
```

可选环境变量：

- `PORT`：服务端端口，默认 `3000`
- `ADMIN_TOKEN`：后台管理口令，默认 `studio-admin`
- `MAX_UPLOAD_SIZE`：单文件上传大小上限，默认 `209715200`（200 MB）

## 内容 API

- `GET /api/content`：读取完整公开内容。
- `PUT /api/content`：保存完整内容，需要 `x-admin-token`。
- `GET /api/site`：读取站点框架。
- `PUT /api/site`：保存站点框架，需要 `x-admin-token`。
- `GET /api/works`：读取全部作品。
- `GET /api/works?category=music`：按分类读取作品。
- `POST /api/works`：创建作品并可上传文件，需要 `multipart/form-data` 和 `x-admin-token`。
- `PUT /api/works/:id`：编辑作品并可替换/移除文件，需要 `x-admin-token`。
- `DELETE /api/works/:id`：删除作品及关联上传文件，需要 `x-admin-token`。
- `GET /api/files/:storedName/download`：下载作品文件。

## 测试

```bash
npm test
```

## 部署提示

`data/uploads/` 和 `data/backups/` 默认不会提交到 Git。生产部署时请挂载持久化磁盘或对象存储，避免实例重建时丢失上传文件。
