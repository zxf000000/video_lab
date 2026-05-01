# ExecPlan: AI 短剧工业化 WebApp

## 1. 目标

基于当前 `Video Lab MVP` 的前后端骨架，规划并实现一套面向“完全 AI 生成、无需真人演员”的短剧工业化 WebApp。

这套系统的目标不是只做一个生成工具页，而是把 AI 短剧的核心生产链路产品化，形成可反复执行的工作流：

1. 立项与项目定义
2. 角色与场景资产沉淀
3. 单集与镜头结构化编辑
4. Prompt 编排
5. 生成任务调度
6. 质检与返工
7. 单集导出
8. 后续发布与数据回流扩展

本期先以 MVP 为目标，优先打通：

- `项目 -> 角色/场景资产 -> 分镜 -> Prompt -> 生成任务 -> 质检返工 -> 单集导出`

同时，系统必须为后续“从创意到剧本”的 AI 生成链路预留一致性框架，避免后续剧本生成仍然退化为自由 prompt 拼接。

## 2. 现状

当前仓库已有的基础能力：

- 前后端分离结构：
  - `apps/backend/`：Python WSGI API 服务
  - `apps/frontend/`：Next.js + TailwindCSS
- 已有项目、镜头、任务、占位生成能力
- 已有 `MockProvider` 与异步任务执行骨架
- 已有项目详情、镜头 prompt 编辑、单镜头生成、批量任务触发等基础页面

当前与目标不匹配的点：

- 数据模型仍围绕“项目 -> 镜头 -> 任务”展开，缺少 AI 短剧生产所需的资产层和集级结构
- 现有 UI 更像“镜头实验台”，不是“流水线控制台”
- prompt 仍偏单镜头临时编辑，缺少可复用的模板和版本体系
- 缺少结构化质检与返工回路
- 缺少单集导出层，镜头结果无法稳定汇总成一集
- 缺少阶段化状态设计，无法表达项目在工业流程中的位置

## 3. 产品定位

本项目应定位为：

- AI 短剧生产工作台
- 不是通用视频编辑器
- 不是纯文本编剧工具
- 不是单次调用模型的 prompt playground

它的核心价值是把“资产、结构、生成、审核、返工、导出”放进同一条可控流水线里。

## 4. 目标流程

### 4.1 MVP 业务主链路

1. 创建项目
2. 填写立项 brief
3. 生成或编辑角色资产
4. 生成或编辑场景资产
5. 创建分集
6. 为单集编辑镜头列表
7. 为镜头生成和调整 prompt
8. 提交批量生成任务
9. 回看结果并做结构化质检
10. 对不合格镜头执行返工
11. 汇总通过镜头并导出单集预览/成片包

### 4.2 后续完整流程

在 MVP 稳定后，扩展为完整工业流程：

1. 项目立项与模板化初始化
2. 项目级故事圣经
3. 角色与场景资产库
4. 分集结构
5. 分场结构
6. 分镜结构
7. Prompt 模板与拼装
8. 生成任务编排
9. 素材结果库
10. 结构化质检
11. 单集合成
12. 发布包
13. 数据复盘
14. 模板与资产沉淀

### 4.3 从创意到剧本的一致性生成链路

在 WebApp 完整形态中，AI 生成不能只覆盖镜头和视频，还必须覆盖“创意 -> 剧本”的上游开发链路。

推荐链路：

1. `Idea Brief`
2. `Project Bible`
3. `Character Pack`
4. `Episode Outline`
5. `Scene Beats`
6. `Screenplay Draft`

核心原则：

- 下游只能读取上游已确认产物，不能直接重新解释用户原始创意
- 每一层只负责单一任务，避免 prompt 职责混杂
- 每一层生成后都必须经历 `Generate -> Review -> Lock`
- 未锁定产物不得流入下一层

## 5. 范围

### In Scope

- 新的 AI 短剧 WebApp 信息架构
- 围绕流水线阶段重构页面结构
- MVP 数据模型升级
- 项目、角色、场景、分集、镜头、prompt、任务、审核、导出主链路
- 任务状态机与返工回路
- 创意到剧本的 AI 一致性生成设计
- 后续扩展所需的演进路线文档

### Out of Scope

- 用户与组织权限体系
- 真实商业发布对接
- 完整时间轴剪辑器
- 复杂多轨音视频编辑器
- 自动化数据采集与投流分析
- 真实模型接入细节的最终供应商选择

## 6. 核心设计

### 6.1 页面流程

完整页面流转应为：

1. 项目总览
2. 立项 Brief
3. 故事圣经
4. 角色资产
5. 场景资产
6. 分集规划
7. 单集详情
8. 分场编辑
9. 分镜 / Shot List
10. Prompt 编排
11. 生成任务
12. 结果库
13. 质检返工
14. 单集合成
15. 成片预览
16. 导出 / 发布包
17. 数据复盘

MVP 页面裁剪为：

- 项目总览
- 角色资产
- 场景资产
- 单集/分镜页
- Prompt 编排页
- 生成任务页
- 质检返工页
- 导出页

后续在“创意到剧本”链路落地时，页面将继续扩展：

- 创意定义页
- 故事圣经页
- 分场编辑页
- 剧本编辑页
- 一致性校验页

### 6.2 MVP 数据模型

MVP 先控制在 10 张表：

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

其中的关键简化：

- `ProjectBrief + StoryBible` 首期合表到 `project_briefs`
- `分场 + 分镜` 首期合并到 `shots`
- `GeneratedAsset` 首期先收进 `generation_tasks.output_assets`
- `EpisodeAssembly + PublishPackage` 首期合并到 `episode_exports`

后续扩展时需要从 MVP 演进出剧本开发相关实体：

- `story_bibles`
- `story_scenes`
- `screenplay_versions`
- `consistency_checks`
- `generation_runs`

### 6.3 MVP 页面与实体映射

- 项目总览：`projects`, `episodes`, `generation_tasks`, `review_issues`
- 立项信息：`project_briefs`
- 角色资产：`characters`
- 场景资产：`scene_presets`
- 单集/分镜：`episodes`, `shots`
- Prompt 编排：`shot_prompts`
- 生成任务：`generation_tasks`
- 质检返工：`review_issues`, `generation_tasks`
- 单集导出：`episode_exports`

### 6.4 状态设计

#### 项目状态

建议项目状态表达“项目当前位于哪一阶段”，而不是表达所有子任务的瞬时状态：

- `draft`
- `brief_ready`
- `assets_ready`
- `episode_in_progress`
- `review_in_progress`
- `export_ready`
- `archived`

后续创意到剧本链路加入后，项目状态可进一步细化为：

- `idea_defined`
- `bible_ready`
- `characters_ready`
- `outlines_ready`
- `scripting_in_progress`
- `visual_generation_in_progress`

#### 镜头状态

- `draft`
- `ready_for_prompt`
- `ready_for_generation`
- `generating`
- `generated`
- `review_failed`
- `review_passed`
- `locked`

#### 创意/剧本开发状态

为后续“创意 -> 剧本”链路，需补充上游对象的统一状态语义：

- `draft`
- `generated`
- `reviewed`
- `locked`
- `superseded`

#### 任务状态

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

#### 导出状态

- `draft`
- `preview_ready`
- `exporting`
- `exported`

### 6.5 返工回路

质检页必须支持把问题打回到明确层级：

- 打回 `shot_prompts`
- 打回 `shots`
- 打回 `characters`
- 打回 `scene_presets`

MVP 不先做“打回分场”和“打回故事圣经”的复杂回路，避免流转过深。

### 6.6 JSON 优先策略

MVP 阶段以下字段优先使用 `json/jsonb` 承载：

- 标签列表
- 服装与声音设定
- 场景变体
- 镜头角色列表
- 模型参数
- 任务输入 payload
- 任务输出 assets
- 导出时间线数据
- 字幕和音轨数据

这样可以降低第一版建模成本，把复杂度留给真正被验证需要拆表的部分。

### 6.7 AI 一致性生成设计

系统必须把“生成一致性”做成架构层能力，而不是零散 prompt 习惯。

#### 6.7.1 唯一事实源

每一层都必须有明确的正式产物，后续层级只能以该产物为输入：

- `Idea Brief`：项目创意、题材、受众、核心钩子
- `Project Bible`：世界规则、主线矛盾、反转规则、禁忌项
- `Character Pack`：身份、动机、关系、语言风格、人物弧线
- `Episode Outline`：每集目标、冲突、高潮、钩子
- `Scene Beats`：每场目标、冲突、揭露、情绪变化
- `Screenplay Draft`：对白、动作、场面表达

禁止下游生成直接回到原始用户 prompt 重新发挥。

#### 6.7.2 单层单责

每个生成步骤只负责一个明确目标：

- Brief 生成器：把创意整理为立项定义
- Bible 生成器：扩展世界规则和主冲突
- Character 生成器：输出人物设定与关系
- Outline 生成器：输出分集骨架
- Scene 生成器：输出场次节拍
- Script 生成器：输出具体对白与动作

禁止一个 agent 在同一轮里同时修改人物设定、剧情结构和台词表达。

#### 6.7.3 Lock 机制

每一层都必须支持：

- `generate`
- `review`
- `lock`

只有被 `lock` 的版本，才允许被下游引用。

这要求系统后续在数据层支持：

- 当前激活版本
- 是否已锁定
- 被哪个下游对象引用

#### 6.7.4 上下文分层

AI 生成时，输入上下文必须按层分开管理，而不是把所有文本混成一个大 prompt：

- 全局项目上下文
- 世界规则上下文
- 角色上下文
- 当前集上下文
- 当前场上下文
- 最近历史摘要

例如在写第 8 集第 3 场时，系统应只注入：

- 项目圣经摘要
- 相关角色卡
- 第 8 集目标与已锁定大纲
- 第 8 集前文摘要
- 当前场任务

而不是把整部剧全文塞进上下文。

#### 6.7.5 不可改动项与可发挥项

后续每层生成都应显式区分：

- 不可改动项：身份、动机、场景、信息揭露点、冲突目标、集尾钩子
- 可发挥项：对白措辞、动作细节、情绪推进方式、局部表达节奏

只有这样才能避免下游生成在写得更流畅的同时，把结构写坏。

#### 6.7.6 一致性校验

每层生成后都要进行回写校验，最少要检查：

- 是否违反世界规则
- 是否改变角色动机
- 是否引入未定义关系
- 是否偏离本集目标
- 是否提前泄露信息
- 是否与上游锁定结构冲突

首期可以由人工 review 为主；完整版本要沉淀为系统化校验器。

### 6.8 一致性校验点

后续产品必须至少支持四类一致性检查：

1. 角色一致性检查
2. 世界规则一致性检查
3. 分集目标一致性检查
4. 场次到剧本落地一致性检查

这些检查点不仅服务于剧本开发，也会反向影响角色资产、场景资产和镜头生成质量。

## 7. API 与系统改造方向

### 7.1 项目层

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`

### 7.2 立项与资产层

- `GET /api/projects/:id/brief`
- `PUT /api/projects/:id/brief`
- `GET /api/projects/:id/characters`
- `POST /api/projects/:id/characters`
- `PUT /api/characters/:id`
- `GET /api/projects/:id/scenes`
- `POST /api/projects/:id/scenes`
- `PUT /api/scenes/:id`

### 7.3 分集与镜头层

- `GET /api/projects/:id/episodes`
- `POST /api/projects/:id/episodes`
- `PUT /api/episodes/:id`
- `GET /api/episodes/:id/shots`
- `POST /api/episodes/:id/shots`
- `PUT /api/shots/:id`

### 7.4 Prompt 与任务层

- `GET /api/shots/:id/prompts`
- `POST /api/shots/:id/prompts`
- `PUT /api/prompts/:id`
- `POST /api/prompts/:id/activate`
- `POST /api/shots/:id/generate`
- `POST /api/episodes/:id/generate-batch`
- `GET /api/tasks/:id`

### 7.5 审核与导出层

- `GET /api/episodes/:id/review-issues`
- `POST /api/review-issues`
- `POST /api/review-issues/:id/resolve`
- `GET /api/episodes/:id/exports`
- `POST /api/episodes/:id/exports`
- `POST /api/exports/:id/render`

### 7.6 后续创意到剧本层

在上游生成链路接入时，需要新增：

- `POST /api/projects/:id/idea/generate`
- `GET /api/projects/:id/bible`
- `PUT /api/projects/:id/bible`
- `POST /api/projects/:id/bible/lock`
- `POST /api/projects/:id/characters/generate`
- `POST /api/projects/:id/episodes/generate`
- `POST /api/episodes/:id/scenes/generate`
- `POST /api/episodes/:id/screenplay/generate`
- `POST /api/consistency-checks/run`
- `GET /api/consistency-checks/:id`

## 8. 前端信息架构

前端导航应按“生产阶段”而不是“数据表”组织：

- 项目总览
- 立项信息
- 角色资产
- 场景资产
- 分集与镜头
- Prompt 编排
- 生成任务
- 质检返工
- 单集导出

前端交互策略：

- 以编辑器 + 工作台双模式组织
- 编辑器负责资产和镜头内容编辑
- 工作台负责任务状态、审核队列、导出队列
- 页面要保留批量操作能力，避免逐条点击

## 9. 后端架构演进

### 9.1 保留

- Python 服务端
- SQLite 作为本地 MVP 数据库
- 现有异步任务执行骨架

### 9.2 需要新增或重构

- Repository 层支持新实体
- Service 层支持资产、镜头、审核、导出主链路
- Job 层支持批量生成、重试、导出
- Provider 层支持从单镜头试验，演进到统一任务输入输出协议
- 更清晰的 API schema 与错误返回
- 后续新增创意到剧本的生成 orchestration 与一致性校验 orchestration

### 9.3 AI 生成编排要求

后续在“创意 -> 剧本”层，后端必须支持一条正式的生成编排链，而不是任意页面直接请求模型：

1. 读取上游已锁定事实源
2. 组装当前层级输入上下文
3. 执行单层生成
4. 落盘生成版本
5. 执行一致性检查
6. 进入人工 review 或自动 lock 前状态

这意味着后端应逐步演进出：

- 统一 generation run 记录
- 统一上下文组装器
- 统一 reviewer 调用层
- 统一 lock / activate 机制

## 10. 实施步骤

### Phase 0：计划确认与信息架构冻结

- 固化本 ExecPlan
- 明确 MVP 页面清单
- 明确 MVP 表结构与 API 边界
- 明确未来创意到剧本链路的事实源与 lock 机制

验收标准：

- 页面、表、API 三层映射稳定
- 不再继续发散抽象设计
- 上游生成链路的层级关系已定义完成

### Phase 1：数据库与后端模型升级

- 新增 `project_briefs`
- 新增 `characters`
- 新增 `scene_presets`
- 新增 `episodes`
- 重构 `shots`
- 新增 `shot_prompts`
- 重构 `generation_tasks`
- 新增 `review_issues`
- 新增 `episode_exports`
- 补充初始化与迁移逻辑

验收标准：

- 本地数据库可支撑 MVP 主链路
- API 层可以创建和读取上述对象

### Phase 2：项目、资产、分集基础 API

- 完成项目详情聚合接口
- 完成 brief 接口
- 完成角色与场景 CRUD
- 完成分集 CRUD
- 完成镜头 CRUD

验收标准：

- 前端可以不依赖 mock 数据完成基础编辑

### Phase 3：Prompt 与任务链路

- 实现 prompt 版本保存与激活
- 实现单镜头生成任务创建
- 实现单集批量生成
- 实现任务状态查询与失败重试

验收标准：

- 用户可以从镜头页直接批量触发生成
- 任务状态可被稳定回查

### Phase 4：结果审核与返工闭环

- 新增审核问题录入
- 新增通过/打回操作
- 支持按镜头查看最近结果
- 支持从审核页跳回 prompt 或镜头

验收标准：

- “生成 -> 审核 -> 打回 -> 重生”的主回路跑通

### Phase 5：单集导出 MVP

- 提供单集导出记录
- 支持选定通过镜头组成导出版本
- 支持生成预览信息和导出产物引用

验收标准：

- 单集可形成一个稳定的导出对象
- 导出页可以展示当前导出版本

### Phase 6：前端工作台重构

- 重构项目总览为流程控制台
- 落地角色资产页
- 落地场景资产页
- 落地单集/分镜页
- 落地 prompt 编排页
- 落地任务页
- 落地质检返工页
- 落地导出页

验收标准：

- 用户可在前端完整跑通 MVP 主链路

### Phase 7：稳定性与体验优化

- 加载态和错误态补齐
- 批量操作体验优化
- 轮询与局部刷新优化
- 空状态和异常状态补齐
- 基础测试补齐

验收标准：

- 主链路无明显阻塞点
- 失败场景可恢复

## 11. 完整开发计划

在 MVP 之后，完整开发计划建议按下列顺序推进。

### Stage A：结构深化

- 从 `shots` 拆出 `story_scenes`
- 从 `project_briefs` 拆出 `story_bibles`
- 从 `generation_tasks.output_assets` 拆出 `generated_assets`
- 从 `episode_exports` 拆出 `publish_packages`
- 补充剧本开发版本表和一致性检查表

完成标准：

- 数据模型从 MVP 合并态升级为稳定领域模型

### Stage B：版本与审计

- 新增 `version_records`
- 新增 `activity_logs`
- 支持角色、场景、prompt、导出版本对比
- 支持关键操作追溯

完成标准：

- 可回查“哪次修改导致当前结果”

### Stage C：模板化与批量化

- brief 模板
- 角色模板
- 场景模板
- prompt 模板
- 批量套用与复制
- 生成链路模板化输入输出

完成标准：

- 新项目初始化明显提速

### Stage D：完整素材库与结果库

- 独立素材管理
- 结果筛选与评分
- 优质结果沉淀为复用模板

完成标准：

- 素材不再只作为任务附件存在

### Stage E：单集合成与时间线升级

- 完整的镜头顺序管理
- 字幕、配音、BGM、音效轨道结构
- 更清晰的预览与成片版本机制

完成标准：

- 从“导出记录”升级为“可控单集合成系统”

### Stage F：发布与复盘

- 发布包管理
- 多平台导出规格
- 数据回流表
- 复盘看板

完成标准：

- 系统开始形成内容效果反馈闭环

### Stage G：真实模型接入与调度优化

- 抽象统一 provider 协议
- 支持多模型、多供应商切换
- 任务成本统计
- 幂等重试与限流控制
- reviewer 模型与主生成模型分层

完成标准：

- 从演示型工作台演进为可持续生产系统

### Stage H：创意到剧本一致性链路

- 上线 `Idea Brief -> Project Bible -> Character Pack -> Episode Outline -> Scene Beats -> Screenplay Draft`
- 为每一层引入 `generate / review / lock`
- 引入上下文分层装配器
- 引入一致性检查任务
- 支持锁定上游版本后再生成下游

完成标准：

- 用户可以从一个创意开始，稳定生成结构一致的剧本
- 系统能明确指出一致性问题发生在哪一层

## 12. 风险

- 当前仓库的数据层与页面结构仍偏实验性质，升级时可能出现兼容债务
- 若过早追求完整工业系统，容易造成 MVP 范围失控
- 若生成任务协议不先规范，后续接真实模型时会重复返工
- 若前端过早实现复杂编辑器，容易在后端主链路未稳前消耗大量时间
- SQLite 适合本地 MVP，但不适合作为长期并发生产数据库
- 若不提前设计创意到剧本的一致性链路，后续剧本开发会重新退回“人工 prompt 工坊”

## 13. 风险缓解

- 严格限制 MVP 范围在 10 张表与 8 个核心页面
- 优先打通后端主链路，再补前端复杂交互
- 对复杂结构先用 `json/jsonb` 承载，避免过早拆表
- 导出先做“记录型导出”，不急着做完整时间线编辑器
- 在真实模型接入前先统一任务输入输出 schema
- 提前定义上游事实源和 lock 机制，即使 MVP 暂未完整实现页面

## 14. 最小交付

最小交付应满足：

- 可创建项目
- 可编辑立项信息
- 可维护角色与场景资产
- 可创建单集与镜头
- 可为镜头维护 prompt
- 可批量提交生成任务
- 可对结果做通过/打回
- 可形成单集导出记录

只要这条链跑通，系统就已经从“镜头实验项目”升级为“AI 短剧 WebApp MVP”。

## 15. 当前阻塞

当前最大的阻塞不是技术选型，而是实现顺序：

- 如果先做完整 UI，很快会被数据模型反向推翻
- 如果先做完整工业化大模型，会超出当前仓库承载范围

因此后续开发必须严格按：

1. 表结构
2. API
3. 主链路任务
4. 前端页面
5. 扩展能力

这个顺序推进。

同时需要额外坚持一条约束：

- 所有后续“创意到剧本”的 AI 能力，都必须接入统一事实源、锁定机制和一致性校验，不能以独立 prompt 页面形式野生生长。
