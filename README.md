# Video Lab — AI 短剧生产工作台

Video Lab 是一个面向 **AI 短剧工业化生产** 的 WebApp 工作台。

项目已经从早期“剧情 -> 镜头 -> 首尾帧 -> 视频”的实验型 MVP，演进为围绕以下链路组织的生产系统：

```text
Brief / Idea
  -> Characters / Scenes
  -> Episodes
  -> Shots
  -> Shot Prompts
  -> Generation Tasks
  -> Review
  -> Export
```

目标不是做通用视频编辑器，而是把 AI 短剧生产中的结构化事实源、Prompt 编排、异步生成、审核返工和单集导出放进同一套可控流程。

## 当前实现

- 后端：Python WSGI API 服务。
- 前端：Next.js App Router + TypeScript + TailwindCSS。
- 数据库：SQLite。
- 任务执行：本地任务骨架与后台执行逻辑。
- 模型供应商：通过 `apps/backend/video_lab/providers/` 接入 Chatfire / Kling / Seedance / Voice 等 provider。
- Copilot：支持 Brief、Character、Scene、Episode、Shot 等模块的结构化生成 proposal。

前端当前支持：

- 项目列表与项目工作台。
- 项目 Brief 编辑。
- 角色资产管理与角色图生成。
- 场景资产管理与场景图生成。
- 分集规划与单集页面。
- 单集镜头列表。
- Shot Prompt 生成、版本与编辑。
- 生成任务查看与批量生成入口。
- Review / Export 页面雏形。

## 目录结构

```text
apps/
  backend/      # Python WSGI API 服务
  frontend/     # Next.js App Router 前端
data/           # SQLite 和生成产物
memory-bank/    # 项目事实源与当前进度文档
```

关键后端目录：

```text
apps/backend/video_lab/
  routes/        # HTTP API 路由
  domain/        # 新领域模块：projects/assets/shots/prompts/generation/review_export/story_dev
  providers/     # 模型供应商适配
  db.py          # SQLite 初始化与迁移
  jobs.py        # 任务执行骨架
  pipeline.py    # 旧流水线兼容
  repository.py  # legacy 兼容层，后续应逐步瘦身
  services.py    # legacy 兼容层，后续应逐步瘦身
```

关键前端目录：

```text
apps/frontend/app/                     # Next.js 页面路由
apps/frontend/src/api.ts               # 当前 API client / 类型 / normalizer
apps/frontend/src/components/project/  # 项目工作台布局与组件
apps/frontend/src/components/copilot/  # 统一 Copilot 壳子
apps/frontend/src/components/ui/       # UI 基础组件
```

## 启动方式

### 1. 启动后端

```bash
cd apps/backend
VIDEO_LAB_DATA_DIR=../../data python3 app.py
```

后端地址：

```text
http://127.0.0.1:8000
```

### 2. 启动前端

首次需要安装依赖：

```bash
cd apps/frontend
npm install
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
- `GET /api/projects/:id/brief`
- `PUT /api/projects/:id/brief`
- `GET /api/projects/:id/characters`
- `POST /api/projects/:id/characters`
- `GET /api/projects/:id/scenes`
- `POST /api/projects/:id/scenes`
- `GET /api/projects/:id/episodes`
- `POST /api/projects/:id/episodes`
- `GET /api/episodes/:episode_id/shots`
- `POST /api/episodes/:episode_id/shots`
- `GET /api/shots/:shot_id/prompts`
- `POST /api/shots/:shot_id/prompts`
- `POST /api/shots/:shot_id/generate`
- `POST /api/episodes/:episode_id/generate-batch`
- `GET /api/tasks/:task_id`

## 模型供应商位置

- `apps/backend/video_lab/providers/`

供应商相关能力应优先通过 provider 层扩展，避免业务逻辑直接耦合具体模型 API。

## 当前架构注意事项

- `apps/backend/video_lab/domain/` 已经建立领域模块，但旧 `repository.py` / `services.py` 仍承担大量兼容逻辑。
- 新业务应优先进入 domain modules，避免继续膨胀 legacy 文件。
- `apps/frontend/src/api.ts` 当前较大，后续建议拆分为 API client、types、normalizers 和各业务模块。
- 项目事实源记录在 `memory-bank/`，每次继续开发前应先阅读。

## 下一步方向

近期优先级：

- 建立并维护 Memory Bank。
- 验证单集主链路：Episodes -> Shots -> Prompts -> Generation -> Review -> Export。
- 拆分前端 `src/api.ts`。
- 收敛后端领域模块，减少 legacy `services.py` / `repository.py` 新增逻辑。
- 更新测试与启动校验，确保核心链路稳定。

## 数据文件

- SQLite 数据库：`data/video_lab.sqlite3`
- 产物目录：`data/assets/`

## 一键本地启动

从仓库根目录运行：

```bash
./start.sh
```

脚本会启动：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:3000`
