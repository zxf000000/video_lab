# Plan: Copilot 生成结果评价功能集成 + 设计优化

## 现状

- 当前只有 `brief` 和 `character` 两个 copilot 模块
- 评价功能是独立的 Python 脚本 (`validate_character.py`)
- 评价结果没有集成到前端 UI

## 集成方案

### 1. 后端：新增评价 API

**文件:** `apps/backend/video_lab/routes/copilot.py`

新增端点 `POST /api/copilot/evaluate`：
```python
{
  "module_type": "character",  # 或 "brief"
  "project_id": 433,
  "proposal": { ... },        # copilot 返回的 proposal
  "context": { ... }          # 同 buildContext
}
```

返回：
```python
{
  "scores": {
    "brief_relevance": {"score": 8, "reason": "..."},
    "role_completeness": {"score": 9, "reason": "..."},
    "drama_value": {"score": 7, "reason": "..."},
    "visual_quality": {"score": 6, "reason": "..."},
    "issues": {"score": 8, "reason": "..."}
  },
  "total": 38,
  "max": 50,
  "grade": "B",
  "overall_comment": "..."
}
```

评价逻辑：复用现有 `validate_character.py` 的规则检查 + LLM 语义评判，封装为函数供 API 调用。

### 2. 前端：Proposal 评价展示

**文件:** `apps/frontend/src/components/copilot/ProjectCopilotShell.tsx`

在 proposal 展示区域增加评价徽章：
- 生成 proposal 后自动调用 `/api/copilot/evaluate`
- 显示分数徽章（绿/黄/红）
- 点击展开查看各维度详情和建议
- 不阻断用户操作（advisory，非 blocking）

### 3. 前端：Progressive Generation 评价

**文件:** `apps/frontend/app/projects/[id]/characters/page.tsx`

渐进式生成流程中：
- 每次生成角色后自动评价
- 在角色卡片上显示质量标签
- 低分时提示"建议重新生成"

## 设计优化建议

### A. 评价维度按模块类型定制

| 模块 | 评价维度 |
|------|----------|
| brief | 完整性、冲突丰富度、世界观清晰度、受众匹配度 |
| character | brief关联度、角色功能、爽感贡献、视觉设定质量、潜在问题 |

### B. 评价触发策略

- **自动评价**: proposal 生成后自动触发（默认）
- **延迟加载**: 先显示 proposal，评价在后台异步进行，完成后追加显示
- **缓存**: 同一 proposal 不重复评价（用 proposal hash 做 key）

### C. 评分展示设计

```
┌─────────────────────────────────────────┐
│  角色: 林渊 (猫猫山伯爵)                  │
│  ┌──────┐                               │
│  │ 82分 │ B 良好   Brief关联度 ████████░░ │
│  └──────┘           角色功能   █████████░ │
│                     爽感贡献   ████████░░ │
│                     视觉设定   ██████░░░░ │
│                     潜在问题   ███████░░░ │
│  💡 建议: 视觉提示词缺少猫猫元素           │
└─────────────────────────────────────────┘
```

### D. 低分处理

- 总分 < 60: 红色徽章 + "建议重新生成" 按钮
- 总分 60-80: 黄色徽章 + 显示改进建议
- 总分 > 80: 绿色徽章 + "质量良好"

### E. Brief 模块的评价（新增）

Brief 评价维度：
1. **完整性**: logline、世界观、主冲突、人物关系是否都填写
2. **冲突丰富度**: 主冲突是否有足够张力和反转空间
3. **世界观清晰度**: 规则是否明确、不矛盾
4. **受众匹配**: 题材/风格是否匹配目标受众

## 实施步骤

1. 后端：将 `validate_character.py` 的核心逻辑提取为可复用模块
2. 后端：新增 `/api/copilot/evaluate` 端点
3. 前端：在 `ProjectCopilotShell` 中集成评价展示
4. 前端：在 `characters/page.tsx` 渐进式流程中集成评价
5. 后端：新增 brief 模块的评价逻辑
6. 前端：brief 页面集成评价展示

## 风险

- LLM 评价每次调用消耗 token（约 500 tokens/次）
- 评价延迟可能影响用户体验（需异步加载）
- 评价结果的主观性（不同模型可能给不同分数）
