# System Patterns

## 当前总体架构

```text
Frontend: Next.js App Router
  -> src/api.ts API client / types / normalizers
  -> Project workspace pages
  -> Copilot shell and module adapters

Backend: Python WSGI
  -> routes/
  -> domain/ services and repositories
  -> legacy services.py / repository.py compatibility layer
  -> SQLite
  -> jobs.py / pipeline.py
  -> providers/
```

## 目标分层

```text
Frontend Pages
  -> API Routes
    -> Application Services
      -> Repositories
        -> SQLite
    -> Job Orchestrators
      -> Providers
```

## 后端领域模块

目标领域模块为：

- `projects`: 项目、Brief、项目总览。
- `story_dev`: 上游故事开发、Copilot 上下文、一致性校验。
- `assets`: 角色、场景、参考图、资产生成。
- `shots`: 分集、镜头列表、镜头结构编辑。
- `prompts`: Shot Prompt 版本、激活、拼装。
- `generation`: 生成任务、批量任务、重试、任务结果。
- `review_export`: 审核问题、返工、单集导出。

## 当前架构现实

当前处于新旧并存状态：

- `apps/backend/video_lab/domain/` 已经存在目标领域目录。
- `apps/backend/video_lab/routes/projects.py` 已开始调用 domain services。
- 旧 `apps/backend/video_lab/repository.py` 和 `apps/backend/video_lab/services.py` 仍包含大量业务逻辑。
- 后续新增业务应优先进入 domain modules，避免继续膨胀 legacy 文件。

## 前端模式

前端使用：

- Next.js App Router 页面路由。
- `src/components/project/` 作为项目工作台布局与上下文。
- `src/components/copilot/` 作为统一 Copilot 壳子。
- `src/api.ts` 目前承担 API、类型、normalize、stream 等职责，后续需要拆分。

## 状态与数据原则

- 项目状态表达项目当前生产阶段。
- Episode 状态表达单集内容准备程度。
- Shot 状态表达镜头生成和审核阶段。
- Task 状态表达异步任务执行情况。
- Prompt 应版本化，生成任务应能追溯使用的 Prompt。