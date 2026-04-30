# ExecPlan: 创建项目改为先生成大纲 + 角色卡，支持手动按集生成剧本

## 1. 目标

把当前“创建项目后自动跑完整条 story -> screenplay -> beats -> shots 链路”的流程，改成两阶段：

1. 创建项目时只生成项目级内容：`大纲 + 角色卡`
2. 用户在项目详情页里手动选择某一集，再从大纲生成该集剧本，支持单集重复生成

同时去掉创建阶段对 `target_duration` 的依赖，不再要求在项目创建时设置目标时长。

## 2. 现状

当前实现存在几个与目标冲突的点：

- `POST /api/projects` 强制接收并校验 `target_duration`
- 创建项目后默认调用 `start_pipeline()`，最终自动跑到 `split_shots`
- `projects` 只存项目级 `story_content / screenplay_content / beats_content`
- 系统没有“集”的数据模型，无法承载“单集生成”
- 前端创建弹窗 `CreateProjectDrawer` 把“目标时长”作为必填步骤
- 项目详情页按 `剧情 / 剧本化 / 节拍 / 角色场景 / 分镜` 组织，不适合先大纲、后分集

## 3. 目标流程

### 3.1 创建项目

创建项目输入保留：

- 标题
- 剧情需求或改写方向
- 风格
- 画面比例

创建项目输出改为：

- 项目级大纲
- 项目级角色卡
- 可选：项目级场景库

创建完成后项目进入 `outline_ready` 或 `characters_ready` 一类的中间状态，而不是直接进入 `shots_ready`。

### 3.2 分集创作

用户在项目页看到大纲后，可执行：

- 从大纲初始化分集列表
- 只生成某一集剧本
- 重新生成某一集剧本
- 手动编辑某一集标题 / 集概 / 剧本

每一集生成时，输入应至少包括：

- 项目标题
- 项目级大纲
- 角色卡
- 当前集标题 / 当前集目标剧情
- 前情上下文（上一集摘要，可选）

### 3.3 后续扩展

本次改造先把“单集剧本生成”做成稳定主链路。是否继续为单集生成 beats / shots，可留在后续迭代。

## 4. 范围

### In Scope

- 创建项目 API 改为生成大纲 + 角色卡
- 去掉创建阶段 `target_duration` 必填约束
- 新增“集”级数据模型
- 支持单集生成 / 重生成 / 编辑剧本
- 项目详情页调整为围绕“大纲 + 分集”工作流
- 状态与任务类型扩展

### Out of Scope

- 旧项目数据自动完整迁移为分集剧本
- 单集自动拆 beats / shots 的完整新链路
- 复杂的跨集 continuity 校验器
- 新的时间轴和视频渲染逻辑重构

## 5. 核心设计

### 5.1 文本层级重构

把现有项目级文本语义重新划分为：

- `story_content`：改为“项目级大纲”
- `screenplay_content / beats_content`：不再作为主创作载体
- 新增 `episodes` 表：承载单集标题、单集摘要、单集剧本等内容

如果希望减少兼容成本，本期可以保留旧字段，但 UI 和新逻辑不再依赖它们。

### 5.2 新增 episodes 表

建议新增 `episodes`：

- `id`
- `project_id`
- `episode_number`
- `title`
- `outline_summary`
- `screenplay_content`
- `screenplay_content_en`
- `status`
- `created_at`
- `updated_at`

建议新增 `episode_versions`：

- `id`
- `episode_id`
- `content`
- `content_en`
- `version`
- `created_at`

这样单集重生成、手动编辑、版本回滚都有稳定落点。

### 5.3 项目状态

建议新增或替换以下状态：

- `draft`
- `generating_outline`
- `outline_ready`
- `generating_characters`
- `project_ready`
- `generating_episode_screenplay`

如果同一项目允许多个单集并发生成，项目状态不要再精确代表每个 episode 的瞬时状态。更合理的做法是：

- 项目只表达“项目级材料是否就绪”
- 单集自己的状态写在 `episodes.status`
- 实时进度主要看 `tasks`

### 5.4 任务类型

建议新增任务类型：

- `generate_outline`
- `generate_episode_list`
- `generate_episode_screenplay`

已有任务里：

- `generate_characters` 可复用，但输入从“剧情全文”改为“项目级大纲”
- `generate_scenes` 本期可选，不作为创建强依赖
- `generate_screenplay / generate_beats / split_shots` 从创建主链路移除

### 5.5 创建流水线

创建项目的新流水线建议改成：

1. `generate_outline`
2. `generate_characters`
3. 可选 `generate_episode_list`

依赖图可以简化为：

- `generate_outline`: []
- `generate_characters`: [`generate_outline`]
- `generate_episode_list`: [`generate_outline`]

创建时不再触发 `split_shots`。

### 5.6 单集生成链路

新增 episode 级服务方法：

- `services.generate_episode_screenplay(project_id, episode_id)`
- `services.update_episode_screenplay(episode_id, content, content_en)`
- `services.restore_episode_version(episode_id, version_id)`

生成逻辑：

1. 读取项目级大纲
2. 读取角色卡
3. 读取当前集 `title + outline_summary`
4. 组装 prompt 生成当前集剧本
5. 写回 `episodes.screenplay_content`
6. 记录版本

## 6. API 改造

### 6.1 项目创建

`POST /api/projects`

调整点：

- `target_duration` 改为可选，允许空值或后置设置
- `generate` 的含义改为“是否自动生成项目级材料”
- 成功后触发新项目流水线，而不是旧全链路

### 6.2 项目详情

`GET /api/projects/:id`

返回新增：

- `episodes`
- 项目级 `outline_content` 或复用 `story_content` 但前端按“大纲”解释

### 6.3 Episodes API

建议新增：

- `GET /api/projects/:id/episodes`
- `POST /api/projects/:id/episodes`
- `PUT /api/episodes/:episode_id`
- `POST /api/episodes/:episode_id/screenplay`
- `PUT /api/episodes/:episode_id/screenplay`
- `GET /api/episodes/:episode_id/versions`
- `POST /api/episodes/:episode_id/versions/:version_id/restore`

如需从大纲自动初始化分集，再补：

- `POST /api/projects/:id/episodes/generate`

## 7. Prompt 与服务层调整

### 7.1 Outline Prompt

新增独立的 outline prompt，输出应包含：

- 故事主线
- 核心冲突
- 主要角色关系
- 分集建议

建议结构化输出，至少能稳定解析出：

- 项目级大纲正文
- 分集列表（可选）

### 7.2 Character Prompt

`generate_characters` 的输入从完整剧情改为“大纲 + 角色关系 + 关键事件”，这样创建阶段仍可生成可用角色卡。

### 7.3 Episode Screenplay Prompt

新增单集剧本 prompt，输入应包含：

- 项目设定
- 当前集标题
- 当前集集概
- 前情摘要
- 角色卡

输出目标仍可保持双语结构，但至少保证中文稳定可用。

## 8. 前端改造

### 8.1 创建弹窗

`CreateProjectDrawer` 调整为两步：

1. 基本信息
2. 风格与画面比例

删除“目标时长”步骤和所有文案依赖。

提交成功提示改成：

- “项目已创建，AI 正在生成大纲和角色卡”

### 8.2 项目详情页结构

建议把标签改为：

- `overview`
- `outline`
- `episodes`
- `characters`
- `storyboard`

其中：

- `outline` 展示项目级大纲，支持编辑与版本化
- `episodes` 展示分集列表、单集剧本编辑器、单集生成按钮

### 8.3 单集页或单集面板

首期可以先不做独立路由，先在 `EpisodesTab` 中实现：

- 左侧分集列表
- 右侧当前集剧本编辑器
- “从大纲生成本集剧本”
- “重新生成本集剧本”

这样改动比新增页面路由更小。

## 9. 兼容与迁移

### 9.1 数据库迁移

在 `db.py` 的 `_migrate_schema()` 中新增：

- `episodes`
- `episode_versions`
- 可选的 `projects.outline_content` 字段

如果不新增 `outline_content`，则暂时把现有 `story_content` 解释为“大纲”。

### 9.2 老项目兼容

老项目短期兼容策略：

- 如果项目已有 `shots`，仍保留旧页签可见性，或者只读展示
- 如果没有 `episodes` 但有 `screenplay_content`，可在 `EpisodesTab` 里显示“未初始化分集”

不要在本期做自动回填，避免把旧项目误拆成错误分集。

## 10. 实施顺序

1. 数据层
   - 新增 `episodes` 与 `episode_versions`
   - 扩展 repository 的 CRUD 与序列化
2. 后端服务层
   - 新增 `generate_outline`
   - 改造 `generate_characters`
   - 新增 `generate_episode_screenplay`
3. 流水线
   - 创建新项目流水线只跑 outline + characters
   - 从 `start_pipeline()` 中去掉默认 `split_shots`
4. API
   - 调整 `POST /api/projects`
   - 增加 episode 路由
5. 前端
   - 改 `CreateProjectDrawer`
   - 改 `ProjectPageClient` 标签结构
   - 新增 `OutlineTab` / `EpisodesTab`
6. 测试
   - API 单测
   - 创建流程 E2E
   - 单集生成 E2E

## 11. 验收标准

- 创建项目时不再要求填写 `target_duration`
- 创建项目后只生成大纲和角色卡，不自动生成镜头
- 项目详情页可以看到并编辑大纲
- 用户可以初始化分集并只生成某一集剧本
- 某一集剧本可重复生成且不影响其他集
- 单集剧本有版本历史
- 现有项目不会因为这次改造直接损坏或无法打开

## 12. 风险

### 风险 1：复用 `story_content` 代表“大纲”会造成命名混乱

短期可接受，但后续应考虑显式引入 `outline_content`。

### 风险 2：没有 episode 级状态会导致并发生成 UI 混乱

必须给 `episodes` 单独加 `status`，不要只看项目状态。

### 风险 3：旧的 `screenplay / beats / shots` 入口仍然暴露会让用户误入旧链路

前端必须收敛入口，至少先把旧入口从主导航移走。

## 13. 建议落地策略

建议采用“兼容式重构”，不要一次删除旧字段和旧服务：

- 保留旧的 `generate_screenplay / generate_beats / split_shots`
- 但创建流程与主 UI 不再走它们
- 等单集工作流稳定后，再决定是否把分镜能力迁移到 episode 维度
