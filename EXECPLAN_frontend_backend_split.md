# ExecPlan: 前后端分离重构为 Next.js + TailwindCSS

## 1. 目标

将当前单体 WSGI 页面应用重构为前后端分离架构：

- 后端：Python API 服务，继续负责项目、镜头、任务、产物和异步执行
- 前端：Next.js + TailwindCSS 单页应用，负责项目创建、任务操作和结果展示

本次重构的目标不是引入更多业务功能，而是把现有能力迁移到更适合后续扩展的前后端结构上。

## 2. 范围

### In Scope

- 保留现有 SQLite、任务执行器和 MockProvider
- 将后端 HTML 渲染改为 JSON API
- 新建 `frontend/` Next.js + TailwindCSS 项目
- 接通以下核心界面：
  - 项目列表 / 新建项目
  - 项目详情
  - 剧情展示
  - 镜头列表
  - 单镜头 Prompt 编辑
  - 单镜头生成首尾帧 / 视频
  - 批量生成全部首尾帧 / 视频
  - 任务状态展示

### Out of Scope

- 用户系统
- 真正的视频播放器与时间线编辑器
- 真实模型接入
- 完整 API 鉴权

## 3. 现状问题

- 当前前端由 Python 字符串模板拼接生成，后续 UI 迭代成本高
- 页面和路由与业务逻辑耦合过深，不利于替换交互层
- 批量任务虽然已异步化，但前端状态刷新方式仍较原始
- 接入真实模型后，需要更灵活的状态轮询和局部刷新能力

## 4. 目标架构

### 后端

- 保留 `video_lab/` 作为核心业务包
- 新增 API 路由层，统一返回 JSON
- 保留：
  - `db.py`
  - `repository.py`
  - `services.py`
  - `jobs.py`
  - `providers.py`

### 前端

- `frontend/` 目录独立维护
- Next.js
- TailwindCSS 负责样式系统
- 通过 `fetch` 请求后端 API

## 5. API 设计

### 项目

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/story`
- `POST /api/projects/:id/shots`
- `POST /api/projects/:id/generate-all-frames`
- `POST /api/projects/:id/generate-all-videos`

### 镜头

- `POST /api/shots/:id/prompt`
- `POST /api/shots/:id/frames`
- `POST /api/shots/:id/video`

### 资源

- `GET /assets/:filename`

## 6. 实施步骤

### Phase 1：后端 API 化

- 新增 JSON 响应工具
- 新增 `/api/*` 路由
- 保留原数据结构和任务执行逻辑
- 允许前端查询项目详情和任务状态

验收标准：

- 不依赖 HTML 页面，也能通过 API 完成主要业务操作

### Phase 2：Next.js 前端初始化

- 初始化 Next.js 项目
- 接入 TailwindCSS
- 配置开发代理或环境变量指向后端 API

验收标准：

- 能启动 Next.js 开发环境并显示基础页面

### Phase 3：核心页面迁移

- 项目列表 / 新建项目
- 项目详情页
- 镜头卡片与任务状态

验收标准：

- 可以从 Next.js 页面完成现有主链路

### Phase 4：交互完善

- Prompt 编辑表单
- 任务状态刷新
- 加载态 / 错误态

验收标准：

- 页面不需要刷新整页即可完成主要操作

## 7. 风险

- 当前机器无 Node 环境时，必须先装 Node 才能构建 Next.js 前端
- Tailwind 和 Next.js 依赖安装需要网络
- 现有服务仍占用 8000 端口，重构后需明确前后端端口分配

## 8. 风险缓解

- 后端保留当前业务层，减少重写面积
- 前端优先做最小页面，不引额外状态管理库
- 开发阶段使用两个端口：
  - 后端 `8000`
  - 前端 `5173`

## 9. 最小交付

- 后端可返回 JSON API
- 前端能创建项目、查看项目、编辑 Prompt、触发任务、查看任务状态
- 前后端可以独立运行

## 10. 当前阻塞

要完整交付 `Next.js + TailwindCSS` 前端，需要先安装 Node.js 和 npm。
