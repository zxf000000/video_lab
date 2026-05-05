# Progress

## 已完成 / 已具备

### 基础工程

- 前后端分离结构已存在。
- 后端 Python WSGI API 服务可启动。
- 前端 Next.js App Router 可启动。
- SQLite 数据库和本地 assets 目录已建立。

### 项目工作台

- 项目列表与项目详情。
- 项目 Brief 页面。
- Characters 页面。
- Scenes 页面。
- Episodes 页面。
- Episode Shots 页面。
- Tasks 页面。
- Review 页面。
- Export 页面。

### 数据与后端能力

- projects / characters / scenes / episodes / shots / tasks 等基础表已存在。
- episode_versions / story_versions / screenplay_versions / beats_versions 已存在。
- shot prompt 相关字段已加入：start_frame_prompt / end_frame_prompt / video_prompt。
- character 资产字段已扩展：visual_profile / image_prompt / negative_prompt / status / version_no 等。
- domain 领域目录已建立。
- routes/projects.py 已开始调用 domain services。

### Copilot

- 统一 Copilot shell 已存在。
- 支持 brief / character / scene / episode / shot 模块。
- 支持 CharacterCollectionProposal、SceneCollectionProposal、EpisodeCollectionProposal、ShotCollectionProposal。

### 生成与 Provider

- jobs.py 任务骨架存在。
- pipeline.py 旧流水线仍存在。
- providers 层支持 Chatfire / Kling / Seedance / Voice 等方向。
- episode 级生成、拆镜头、批量生成相关能力已开始落地。
- 角色图片生成已调整为素描参考图策略。
- 首帧图、Chatfire 视频生成、Seedance prompt-video 路径已加入“素描参考恢复真人写实”的提示词约束。

## 当前问题

- 后端 `services.py` / `repository.py` 仍过大。
- 前端 `src/api.ts` 过大，类型、normalize、请求函数混杂。
- episodes 字段存在兼容命名并存，例如 `episode_number` / `episode_no`、`outline_summary` / `summary`。
- 需要继续验证单集闭环是否稳定：Episode -> Shots -> Prompts -> Generation -> Review -> Export。
- 角色素描参考恢复为真人写实目前主要通过提示词约束完成，尚未做端到端视觉效果验收。

## 下一步

1. 用真实项目验证：生成角色素描图 -> 生成首帧图 -> 生成视频，观察是否能稳定恢复真人写实风格。
2. 验证单集主链路页面和 API 是否一致。
3. 选择一个模块拆分 `src/api.ts` 作为样板。
4. 后端新逻辑停止进入 legacy 文件，逐步迁移到 domain modules。
5. 补充最小测试或启动校验，确保改动不破坏现有流程。