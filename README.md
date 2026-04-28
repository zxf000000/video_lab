# Video Lab MVP

一个用于验证“剧情 -> 镜头 -> 首尾帧 -> 视频”链路的小项目。

当前版本已经拆成前后端分离：

- 后端：Python WSGI API 服务
- 前端：Next.js + TailwindCSS

## 当前实现

- 后端使用 Python 标准库 `wsgiref` 启动本地 API 服务
- 后端使用 SQLite 保存项目、镜头和任务数据
- 后端使用本地线程池执行后台任务
- 后端仍使用 `MockProvider` 占位剧情、首尾帧和视频生成
- 前端使用 Next.js + TailwindCSS
- 前端支持：
  - 创建项目
  - 查看项目列表
  - 通过 `/projects/:id` 进入独立项目详情页
  - 通过 `/projects/:id/shots/:shotId` 进入单镜头详情页
  - 查看剧情段落
  - 编辑单镜头 prompt
  - 单镜头生成首尾帧
  - 单镜头生成视频占位产物
  - 批量生成全部镜头首尾帧和视频
  - 查看后台任务状态和错误信息

## 目录结构

```text
app.py
video_lab/      # Python 后端
frontend/       # Next.js + TailwindCSS 前端
data/           # SQLite 和产物文件
```

## 启动方式

### 1. 启动后端

```bash
python3 app.py
```

后端地址：

```text
http://127.0.0.1:8000
```

### 2. 启动前端

首次需要安装依赖：

```bash
source ~/.zshrc && npm install
```

```bash
npm run dev
```

前端地址：

```text
http://localhost:3000
```

## 主要 API

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/story`
- `POST /api/projects/:id/shots`
- `POST /api/projects/:id/generate-all-frames`
- `POST /api/projects/:id/generate-all-videos`
- `POST /api/shots/:id/prompt`
- `POST /api/shots/:id/frames`
- `POST /api/shots/:id/video`

## 后续替换真实模型的位置

- `video_lab/providers.py`

建议替换以下方法：

- `generate_story`
- `split_story_into_shots`
- `generate_frame_svg`
- `generate_video_storyboard`

其中：

- 首尾帧生成建议改为真实图像模型调用
- 视频生成建议改为真实 image-to-video 或 frame-guided video 接口

## 数据文件

- SQLite 数据库：`data/video_lab.sqlite3`
- 产物目录：`data/assets/`
