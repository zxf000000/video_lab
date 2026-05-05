# Project Brief

## 项目定位

本项目是一个面向 **AI 短剧工业化生产** 的 WebApp 工作台，而不是单次模型调用工具、通用视频编辑器或纯文本编剧工具。

核心目标是把短剧生产中的“创意、资产、分集、分镜、Prompt、生成、审核、导出”纳入同一条可控工作流。

## 当前主链路

当前产品主链路为：

```text
Brief / Idea
  -> Characters / Scenes
  -> Episodes
  -> Shots
  -> Shot Prompts
  -> Generation Tasks
  -> Review Issues
  -> Episode Export
```

## 长期目标链路

长期目标支持两条完整链路：

1. 上游创意开发链路：

```text
Idea -> Bible -> Characters -> Episode Outline -> Scene Beats -> Screenplay
```

2. 下游视觉生产链路：

```text
Assets -> Shots -> Prompts -> Generation -> Review -> Export
```

## 当前阶段目标

当前阶段应优先完成单集生产闭环：

```text
Episode Outline
  -> Episode Screenplay
  -> Shot List
  -> Shot Prompt
  -> Batch Generation
  -> Review
  -> Export Preview
```

## 范围边界

当前不优先做：

- 用户/组织权限体系
- 完整时间轴剪辑器
- 复杂多轨音视频编辑
- 商业发布系统
- 投流数据回流

当前优先做：

- 项目工作台稳定性
- Copilot 结构化生成
- 分集/分镜/Prompt/生成闭环
- 领域模块收敛
- 文档与架构事实源同步