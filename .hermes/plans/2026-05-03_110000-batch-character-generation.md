# Plan: 渐进式角色生成 — 每个角色直接带 image_spec

## Goal

在现有的渐进式（一次生成 1 个角色）流程中，生成角色时直接带上完整的 image_spec，不再分两步。用户看到的流程从：

```
生成角色卡 (profile) → 选中角色 → 再生成视觉设定 (image_spec)
```

变成：

```
生成角色卡 + 视觉设定 (一步到位)
```

## Current Context

当前渐进式流程：
1. `profile_collection` 阶段：每次生成 1 个角色，但 image_spec 是空占位
2. `visual_refine` 阶段：用户选中角色后再触发 image_spec 生成

问题：用户需要两步才能拿到一个完整角色，体验割裂。

## Assumptions

- 保留 visual_refine 流程不动（用户仍可对已有角色单独调 image_spec / 变体）
- profile_collection 阶段改为同时输出 profile + image_spec
- image_spec 质量依赖 appearance_summary 的质量，所以 prompt 要引导 AI 在 profile 中写好外观描述

## Proposed Approach

### 改动 1: system.txt

第 13 条规则（profile_collection 阶段）：

当前：
> profile_collection 阶段：每次只输出 1 个关键角色，重点填写 character_profile，image_spec 可以保留为空字符串和空数组

改为：
> profile_collection 阶段：每次只输出 1 个关键角色。character_profile 和 image_spec 必须同时完整填写。image_spec 应基于 character_profile 中的 appearance_summary 自动推导，image_prompt 必须可直接用于出图。

### 改动 2: generate.txt

当前第 2 条：
> 在 profile_collection 阶段，只重点输出 character_profile；image_spec 保持最小占位

改为：
> 在 profile_collection 阶段，同时输出完整的 character_profile 和 image_spec。image_spec 应基于角色的人设和外观描述自动推导，image_prompt 必须可直接用于出图，negative_prompt 也要填写。

### 改动 3: characters/page.tsx

前端已有 generation_stage = profile_collection 的逻辑，无需改 UI 流程。只需确认：
- profile_collection 返回的 proposal 中 image_spec 不为空时，能正确回填到表单
- 验证现有代码中 `_normalize_character_image_spec` 已经处理了这种情况（已确认支持）

## Step-by-Step Plan

1. 修改 `system.txt`：第 13 条规则，profile_collection 同时要求 image_spec
2. 修改 `generate.txt`：第 2 条，去掉"保持最小占位"，改为完整填写
3. 验证前端：确认 characters/page.tsx 中 profile_collection proposal 的 image_spec 回填逻辑正确
4. 测试：创建新项目，渐进式生成 1 个角色，检查 profile + image_spec 都已填写
5. 测试：确认 visual_refine / variant 流程不受影响

## Files Likely to Change

- `apps/backend/video_lab/prompts/copilot_character/system.txt`
- `apps/backend/video_lab/prompts/copilot_character/generate.txt`

## Tests / Validation

- 新建项目 → 填 brief → 生成第一个角色 → 验证 image_spec 各字段非空
- 验证 image_prompt 可直接用于 Seedream
- 验证 visual_refine / 变体流程不变

## Risks

- profile + image_spec 一起生成，AI 可能在 image_spec 上偷懒（字段填了但质量不高）
- 缓解方式：prompt 中强调 image_spec 质量要求，image_prompt 必须可直接出图
