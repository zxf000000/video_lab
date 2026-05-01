# AI 短剧 WebApp 开发架构

## 1. 目标

本文档把 [EXECPLAN_ai_short_drama_webapp.md](/Users/mr.zhou/Desktop/video/EXECPLAN_ai_short_drama_webapp.md) 落成一版可直接开发的架构设计。

目标是支持两条链路：

1. 上游创意开发链路：`Idea -> Bible -> Characters -> Episode Outline -> Scene Beats -> Screenplay`
2. 下游视觉生产链路：`Assets -> Shots -> Prompts -> Generation -> Review -> Export`

原则：

- 上下游都必须使用结构化事实源
- 下游只能读取上游已锁定版本
- 生成、审核、锁定必须是系统能力，不是 prompt 习惯
- 第一版以当前仓库技术栈为基础，不做大规模重写

## 2. 当前技术基座

基于现有代码，建议沿用：

- 后端：Python WSGI + `video_lab/`
- 前端：Next.js App Router
- 数据库：SQLite
- 任务执行：当前 `jobs.py` 异步任务骨架
- 生成提供方：`video_lab/providers/`

当前应保留的核心目录：

- [apps/backend/video_lab/db.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/db.py)
- [apps/backend/video_lab/repository.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/repository.py)
- [apps/backend/video_lab/services.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/services.py)
- [apps/backend/video_lab/jobs.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/jobs.py)
- [apps/backend/video_lab/routes](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/routes)
- [apps/backend/video_lab/providers](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/providers)
- [apps/frontend/app](/Users/mr.zhou/Desktop/video/apps/frontend/app)

## 3. 系统分层

整体分为 6 层：

```text
Frontend Pages
  -> API Routes
    -> Application Services
      -> Repositories
        -> SQLite
    -> Job Orchestrators
      -> Providers
```

各层职责：

- `Frontend Pages`
  负责编辑、查看、批量操作、状态轮询
- `API Routes`
  负责请求校验、DTO 转换、HTTP 错误
- `Application Services`
  负责业务规则、状态流转、聚合读取
- `Repositories`
  负责所有 SQL 读写
- `Job Orchestrators`
  负责异步生成、审核、批处理
- `Providers`
  负责具体模型供应商调用

## 4. 领域模块

后端不要再按“单个大 services.py”继续膨胀，建议逐步收束成 7 个领域模块。

### 4.1 项目模块 `projects`

职责：

- 项目创建
- 项目状态推进
- 项目总览聚合
- 项目 brief 管理

核心实体：

- `projects`
- `project_briefs`

### 4.2 剧本开发模块 `story_dev`

职责：

- Idea Brief 生成
- Bible 生成与锁定
- Character Pack 生成与锁定
- Episode Outline 生成
- Scene Beats 生成
- Screenplay 生成
- 一致性校验

核心实体：

- `project_briefs`
- `characters`
- `episodes`
- 后续 `story_bibles`
- 后续 `story_scenes`
- 后续 `screenplay_versions`
- 后续 `consistency_checks`

### 4.3 资产模块 `assets`

职责：

- 角色资产管理
- 场景资产管理
- 参考图管理
- 版本切换与锁定

核心实体：

- `characters`
- `scene_presets`

### 4.4 镜头模块 `shots`

职责：

- 单集镜头列表
- Shot 结构编辑
- 镜头状态流转

核心实体：

- `episodes`
- `shots`

### 4.5 Prompt 模块 `prompts`

职责：

- 版本化 prompt
- prompt 激活
- 模板化 prompt 拼装
- prompt 生成输入上下文组装

核心实体：

- `shot_prompts`

### 4.6 生成模块 `generation`

职责：

- 单镜头生成
- 批量生成
- 任务重试
- 任务日志
- 输出结果回写

核心实体：

- `generation_tasks`
- 后续 `generation_runs`
- 后续 `generated_assets`

### 4.7 审核与导出模块 `review_export`

职责：

- 结果审核
- 返工打回
- 导出版本
- 单集预览

核心实体：

- `review_issues`
- `episode_exports`

## 5. 推荐目录结构

基于当前代码，推荐演进到下面的结构：

```text
apps/backend/video_lab/
  app/
    dto.py
    errors.py
    response.py
  domain/
    projects/
      service.py
      repository.py
    story_dev/
      service.py
      orchestrator.py
      consistency.py
      repository.py
    assets/
      service.py
      repository.py
    shots/
      service.py
      repository.py
    prompts/
      service.py
      repository.py
    generation/
      service.py
      orchestrator.py
      repository.py
    review_export/
      service.py
      repository.py
  providers/
  routes/
  db.py
  jobs.py
  web.py
```

迁移策略：

- 第一阶段不强行拆完
- 先新增模块文件
- 旧 `repository.py` / `services.py` 作为兼容层逐步瘦身

## 6. 核心数据模型

## 6.1 MVP 表

第一版只实现这 10 张表：

- `projects`
- `project_briefs`
- `characters`
- `scene_presets`
- `episodes`
- `shots`
- `shot_prompts`
- `generation_tasks`
- `review_issues`
- `episode_exports`

## 6.2 后续扩展表

第二阶段以后再补：

- `story_bibles`
- `story_scenes`
- `screenplay_versions`
- `consistency_checks`
- `generation_runs`
- `generated_assets`
- `publish_packages`
- `version_records`
- `activity_logs`

## 6.3 事实源约束

系统中所有 AI 生成都必须引用正式事实源：

- `Project Brief`
- `Bible`
- `Character Pack`
- `Episode Outline`
- `Scene Beats`
- `Shot Prompt`

规则：

- 事实源对象必须有 `status`
- `status=locked` 的版本才允许被下游读取
- 下游生成时必须记录读取了哪些上游版本

## 7. 状态机设计

## 7.1 项目状态机

```text
draft
  -> brief_ready
  -> assets_ready
  -> scripting_in_progress
  -> visual_generation_in_progress
  -> review_in_progress
  -> export_ready
  -> archived
```

说明：

- `Project.status` 只表达主阶段
- 不能拿它表达单个任务是否在跑

## 7.2 上游创作对象状态机

适用于 `Bible / Character Pack / Episode Outline / Scene Beats / Screenplay`：

```text
draft -> generated -> reviewed -> locked -> superseded
```

规则：

- `generated` 只能表示 AI 产出已落盘
- `reviewed` 表示已人工或 AI reviewer 审核
- `locked` 表示可被下游引用
- `superseded` 表示被新锁定版本替代

## 7.3 Shot 状态机

```text
draft
  -> ready_for_prompt
  -> ready_for_generation
  -> generating
  -> generated
  -> review_failed
  -> review_passed
  -> locked
```

## 7.4 Task 状态机

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
```

## 8. 两条编排链路

## 8.1 创意到剧本链路

这是后续必须实现的正式上游编排：

```text
Idea Brief
  -> Project Bible
  -> Character Pack
  -> Episode Outline
  -> Scene Beats
  -> Screenplay Draft
```

每层固定执行 6 步：

1. 读取上游锁定版本
2. 组装当前层上下文
3. 调用对应 provider/agent
4. 保存新版本
5. 触发一致性校验
6. 进入 `reviewed` 或等待人工确认

### 上下文组装规则

不同层读取不同上下文，不能全量拼接：

- `Bible`
  读取：Idea Brief
- `Character Pack`
  读取：Idea Brief + Bible
- `Episode Outline`
  读取：Idea Brief + Bible + Characters
- `Scene Beats`
  读取：Episode Outline + Characters + Bible 摘要
- `Screenplay`
  读取：Scene Beats + Episode Outline + Characters + Bible 摘要

### 一致性检查规则

每层生成后执行以下检查：

- 是否违反世界规则
- 是否修改角色动机
- 是否引入未定义关系
- 是否偏离当前集目标
- 是否破坏已锁定信息揭露顺序

首期实现策略：

- 先保留 `consistency.py` 纯应用层函数入口
- 初始可以人工 review 为主
- 后续再补 reviewer provider

## 8.2 视觉生产链路

MVP 先打通这条：

```text
Project
  -> Characters / Scene Presets
  -> Episode
  -> Shot
  -> Shot Prompt
  -> Generation Task
  -> Review Issue
  -> Episode Export
```

每层规则：

- `Shot` 未到 `ready_for_prompt` 不能创建 prompt
- 没有 `is_active=1` 的 prompt 不能提交生成
- 任务成功后才能进入审核
- 审核通过的镜头才能进入导出

## 9. 后端服务设计

## 9.1 Service 层

每个领域模块至少有一个 service：

- `projects.service`
- `story_dev.service`
- `assets.service`
- `shots.service`
- `prompts.service`
- `generation.service`
- `review_export.service`

service 负责：

- 参数校验后的业务规则
- 状态流转
- 调用 repository
- 调用 orchestrator

禁止事项：

- route 里写复杂业务逻辑
- repository 里做状态决策
- provider 里拼接数据库查询

## 9.2 Orchestrator 层

需要两个编排器：

- `story_dev.orchestrator`
- `generation.orchestrator`

职责：

- 负责多步 AI 任务
- 统一记录输入输出
- 统一失败处理
- 统一下游推进

## 9.3 Repository 层

repository 只做 3 件事：

- 单表 CRUD
- 受控聚合查询
- 事务型写入

建议：

- 每个模块有自己的 repository
- 复杂聚合单独暴露 `get_*_overview()` 风格方法

## 10. API 设计

API 分成 5 组：

## 10.1 Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `GET /api/projects/:id/overview`

## 10.2 Story Dev

- `GET /api/projects/:id/brief`
- `PUT /api/projects/:id/brief`
- `POST /api/projects/:id/idea/generate`
- `GET /api/projects/:id/bible`
- `PUT /api/projects/:id/bible`
- `POST /api/projects/:id/bible/lock`
- `POST /api/projects/:id/episodes/generate`
- `POST /api/episodes/:id/scenes/generate`
- `POST /api/episodes/:id/screenplay/generate`
- `POST /api/consistency-checks/run`

## 10.3 Assets / Shots / Prompts

- `GET /api/projects/:id/characters`
- `POST /api/projects/:id/characters`
- `PUT /api/characters/:id`
- `GET /api/projects/:id/scenes`
- `POST /api/projects/:id/scenes`
- `PUT /api/scenes/:id`
- `GET /api/projects/:id/episodes`
- `POST /api/projects/:id/episodes`
- `PUT /api/episodes/:id`
- `GET /api/episodes/:id/shots`
- `POST /api/episodes/:id/shots`
- `PUT /api/shots/:id`
- `GET /api/shots/:id/prompts`
- `POST /api/shots/:id/prompts`
- `PUT /api/prompts/:id`
- `POST /api/prompts/:id/activate`

## 10.4 Generation

- `POST /api/shots/:id/generate`
- `POST /api/episodes/:id/generate-batch`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/retry`

## 10.5 Review / Export

- `GET /api/episodes/:id/review-issues`
- `POST /api/review-issues`
- `POST /api/review-issues/:id/resolve`
- `GET /api/episodes/:id/exports`
- `POST /api/episodes/:id/exports`
- `POST /api/exports/:id/render`

## 11. 前端架构

## 11.1 页面分区

前端按流程建页面，不按表建页面：

- `/projects`
- `/projects/[id]`
- `/projects/[id]/brief`
- `/projects/[id]/characters`
- `/projects/[id]/scenes`
- `/projects/[id]/episodes`
- `/episodes/[id]/shots`
- `/shots/[id]/prompts`
- `/episodes/[id]/review`
- `/episodes/[id]/export`

后续补：

- `/projects/[id]/bible`
- `/episodes/[id]/scenes`
- `/episodes/[id]/screenplay`
- `/projects/[id]/consistency`

## 11.2 前端分层

推荐逐步收束成：

```text
app/
  projects/
  episodes/
  shots/
components/
  project/
  story-dev/
  assets/
  shots/
  tasks/
  review/
lib/
  api/
  mappers/
  schemas/
```

说明：

- `app/` 放页面与路由
- `components/` 放领域组件
- `lib/api` 放 fetch client
- `lib/mappers` 负责接口 DTO 到 UI model 转换

## 11.3 页面数据策略

第一版建议：

- 列表页服务端拉取
- 编辑页客户端交互
- 任务状态使用轮询
- 不急着引入全局状态库

## 12. 任务与 provider 协议

所有 provider 调用都必须适配统一输入输出协议。

## 12.1 Text Generation Input

```json
{
  "task_type": "generate_episode_outline",
  "project_id": 1,
  "source_refs": [
    {"entity": "project_brief", "id": 1, "version": 3},
    {"entity": "character_pack", "id": 4, "version": 2}
  ],
  "context": {
    "style": "urban revenge",
    "constraints": [],
    "payload": {}
  }
}
```

## 12.2 Generation Task Output

```json
{
  "status": "succeeded",
  "assets": [
    {"type": "image", "url": "/assets/xxx.png"},
    {"type": "video", "url": "/assets/yyy.mp4"}
  ],
  "metadata": {
    "provider": "seedance",
    "model": "v1"
  }
}
```

要求：

- service 层不依赖某个供应商私有字段
- route 层不直接处理 provider 格式

## 13. 开发顺序

按下面的顺序开发，返工最少：

### Phase 1：数据层

- 完成 10 张 MVP 表
- 完成迁移逻辑
- 完成 repository 初版

### Phase 2：后端主链路

- 项目/brief API
- 角色与场景 API
- 分集与镜头 API
- prompt API
- 生成任务 API
- 审核与导出 API

### Phase 3：前端 MVP

- 项目总览
- 角色资产
- 场景资产
- 单集/镜头
- prompt
- 任务
- 审核
- 导出

### Phase 4：创意到剧本上游架构

- Bible service/orchestrator
- Episode outline generation
- Scene beats generation
- Screenplay generation
- consistency check 接口

### Phase 5：结构深化

- 拆 `story_scenes`
- 拆 `story_bibles`
- 拆 `generated_assets`
- 加版本与审计

## 14. 非目标

当前架构刻意不做：

- 全量微服务拆分
- 消息队列基础设施
- 实时 websocket 优先
- 完整媒体编辑器
- 复杂权限系统

原因：

- 当前仓库规模不需要
- 先把业务链跑通更重要

## 15. 第一批可直接开工的文件

如果现在开始实现，建议直接从这些文件开工：

- 新增 [apps/backend/video_lab/domain/projects/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/projects/service.py)
- 新增 [apps/backend/video_lab/domain/assets/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/assets/service.py)
- 新增 [apps/backend/video_lab/domain/shots/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/shots/service.py)
- 新增 [apps/backend/video_lab/domain/prompts/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/prompts/service.py)
- 新增 [apps/backend/video_lab/domain/generation/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/generation/service.py)
- 新增 [apps/backend/video_lab/domain/review_export/service.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/domain/review_export/service.py)
- 重构 [apps/backend/video_lab/db.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/db.py)
- 拆分 [apps/backend/video_lab/repository.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/repository.py)
- 扩展 [apps/backend/video_lab/routes/projects.py](/Users/mr.zhou/Desktop/video/apps/backend/video_lab/routes/projects.py)
- 新增 `routes/characters.py`
- 新增 `routes/scenes.py`
- 新增 `routes/episodes.py`
- 新增 `routes/prompts.py`
- 新增 `routes/review.py`
- 新增 `routes/exports.py`

前端第一批文件：

- 新增 `app/projects/[id]/page.tsx`
- 新增 `app/projects/[id]/characters/page.tsx`
- 新增 `app/projects/[id]/scenes/page.tsx`
- 新增 `app/projects/[id]/episodes/page.tsx`
- 新增 `app/episodes/[id]/shots/page.tsx`
- 新增 `app/shots/[id]/prompts/page.tsx`
- 新增 `app/episodes/[id]/review/page.tsx`
- 新增 `app/episodes/[id]/export/page.tsx`

## 16. 验收标准

这份架构如果被认为“可开发”，必须满足：

- 能明确当前该先写哪些模块
- 能明确每个模块的边界
- 能明确两条生成链路如何编排
- 能明确状态机和锁定机制
- 能明确 MVP 和后续扩展的分界

达到这几点后，就可以直接进入 schema 和实现阶段。 
