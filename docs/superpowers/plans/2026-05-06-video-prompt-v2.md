# Video Prompt V2 第 0 层 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 video_prompt 生成规则，补全初始画面、时间线分段、运镜起幅落幅、对白音色、英文关键词等 6 要素。

**Architecture:** 改动仅限 3 个后端文件 — system.txt（AI 输出规则）、generate.txt（模板字段）、routes/prompts.py（数据注入）。不涉及前端、DB schema、视频生成逻辑。

**Tech Stack:** Python 3, ChatfireProvider (LLM), SQLite via ShotsService/AssetsService

---

### Task 1: 重写 system.txt 的 video_prompt 规则

**Files:**
- Modify: `apps/backend/video_lab/prompts/copilot_shot_prompt/system.txt:46-54`

- [ ] **Step 1: 替换 video_prompt 章节**

将第 46-54 行（当前的 `## video_prompt` 段落 + 图片引用规则）替换为：

```
## video_prompt 规则

视频提示词必须按以下结构用自然中文叙述，覆盖每个要素。图片引用规则见下方「视频提示词的图片引用规则」。

### 1. 初始画面（第 0 秒）
- 第一句描述定格画面：人物在画面哪个区域（左侧/中央/右侧）、面朝哪个方向、什么姿态、环境状态
- 区分静止元素（背景、道具）和即将运动的元素（人物、光线变化）
- 示例：「画面初始：远景平视，苏妙妙站在入口红毯尽头、画面正中央，面朝镜头，宾客分列两侧静止不动」

### 2. 时间线分段
- 根据镜头预估时长划分 2-3 个阶段，每个阶段标注时间范围
- ≤2 秒：1 个动作即可，不强制分段
- 3-4 秒：2 个阶段，通常「建立情境→核心动作」
- 5-8 秒：3 个阶段，通常「建立情境→核心动作→反应/落点」
- 示例：「0-1.5 秒：……」「1.5-3 秒：……」

### 3. 运镜与机位（起幅→落幅）
- 必须同时描述起幅（起始机位/构图）和落幅（终点机位/构图）
- 说明运镜速度（缓慢/快速/先慢后快）和是否为匀速
- 如果落幅停在特定构图，说明停在什么位置
- 示例：「起幅为远景平视，镜头固定；1.5 秒起缓慢匀速推近，落幅至中近景，停在苏妙妙面部」

### 4. 对白落地与音色
- 如果镜头有对白台词（见镜头信息的「对白」字段），必须标注：
  a) 台词在第几秒出现
  b) 由谁说
  c) 该角色的音色和说话风格（从角色详情中的「说话风格与音色」提取）
  d) 说话时的口型、表情变化、身体微动作
  e) 台词说完后相关角色的反应
- 如无对白，此项可省略
- 示例：「1.8 秒起，顾明泽开口，音色醇厚低沉但略带心虚，嘴唇轻启幅度小，眼神由疑惑转为警觉，说完后身侧的林楚楚偷偷瞄了他一眼」

### 5. 画面变化要素
- 说明镜头期间变化的元素：人物位置移动（起点→终点）、光线变化、群演反应、道具移动
- 区分主动变化（人物自主动作）和被动变化（衣摆随步幅摆动、发丝被气流带动）

### 6. 英文技术关键词
- 在中文提示词末尾，追加一行英文关键词，用于增强视频模型的画面理解
- 格式：「Technical keywords: <运镜类型>, <光线风格>, <画质>, <氛围>」
- 示例：「Technical keywords: slow push in, golden hour lighting, shallow depth of field, cinematic, 4K」
```

- [ ] **Step 2: 保留图片引用规则在原位置**

确认第 50-54 行的「视频提示词的图片引用规则」段落保持不动（不删除）。

- [ ] **Step 3: Commit**

```bash
git add apps/backend/video_lab/prompts/copilot_shot_prompt/system.txt
git commit -m "feat: rewrite video_prompt rules in system.txt with 6 structured elements"
```

---

### Task 2: generate.txt 新增前后镜头和位置字段

**Files:**
- Modify: `apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt:9-13`

- [ ] **Step 1: 在镜头信息区域末尾追加 3 行**

在第 13 行（`- 预估时长(秒): {duration_hint}`）之后插入：

```
- 本镜位置: {shot_position}
- 上一镜视觉目标: {prev_shot_goal}
- 下一镜视觉目标: {next_shot_goal}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt
git commit -m "feat: add shot_position, prev/next_shot_goal fields to generate.txt template"
```

---

### Task 3: 路由 — 角色上下文补 speech_style 和 personality_tags

**Files:**
- Modify: `apps/backend/video_lab/routes/prompts.py:176-183`

- [ ] **Step 1: 在 `parts` 构建中追加两个字段**

将第 176-183 行：
```python
                    parts = [f"角色名: {name}"]
                    if char.get("appearance_summary"):
                        parts.append(f"外观: {char['appearance_summary']}")
                    if char.get("appearance_prompt"):
                        parts.append(f"外观提示词: {char['appearance_prompt']}")
                    if image_path:
                        parts.append(f"角色图片路径: /assets/{image_path}")
                    char_descriptions.append(" | ".join(parts))
```

改为：
```python
                    parts = [f"角色名: {name}"]
                    if char.get("appearance_summary"):
                        parts.append(f"外观: {char['appearance_summary']}")
                    if char.get("appearance_prompt"):
                        parts.append(f"外观提示词: {char['appearance_prompt']}")
                    if char.get("speech_style"):
                        parts.append(f"说话风格与音色: {char['speech_style']}")
                    if char.get("personality_tags"):
                        tags = char["personality_tags"]
                        if isinstance(tags, str):
                            try:
                                tags = json.loads(tags)
                            except (json.JSONDecodeError, TypeError):
                                tags = []
                        if isinstance(tags, list):
                            parts.append(f"性格标签: {', '.join(tags)}")
                    if image_path:
                        parts.append(f"角色图片路径: /assets/{image_path}")
                    char_descriptions.append(" | ".join(parts))
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/video_lab/routes/prompts.py
git commit -m "feat: pass speech_style and personality_tags in character context for prompt generation"
```

---

### Task 4: 路由 — 计算相邻镜头和镜头位置序号

**Files:**
- Modify: `apps/backend/video_lab/routes/prompts.py:240-273`

- [ ] **Step 1: 在 duration_hint 之后、video_image_reference_list 之前插入相邻镜头和位置计算**

在第 241 行（`duration_hint = "请根据镜头内容推断合适时长(2-8秒)"` 之后，`# Determine video image references` 之前）插入：

```python
    # Compute shot position within scene_block and adjacent shot goals
    episode_shots = shots_service.repository.list_shots_by_episode(int(shot["episode_id"]))
    current_scene_block = shot.get("scene_block", "")
    same_scene_shots = [s for s in episode_shots if s.get("scene_block") == current_scene_block]
    shot_position = 1
    for i, s in enumerate(same_scene_shots, 1):
        if s["id"] == int(shot_id):
            shot_position = i
            break
    shot_position_hint = f"场次 {current_scene_block} 的第 {shot_position} 个镜头（共 {len(same_scene_shots)} 个）"

    # Find previous and next shot in the same episode
    prev_shot_goal = "无（本场第一个镜头）"
    next_shot_goal = "无（本场最后一个镜头）"
    for i, s in enumerate(episode_shots):
        if s["id"] == int(shot_id):
            if i > 0:
                prev_shot_goal = episode_shots[i - 1].get("visual_goal", "") or "无"
            if i < len(episode_shots) - 1:
                next_shot_goal = episode_shots[i + 1].get("visual_goal", "") or "无"
            break
```

- [ ] **Step 2: 在 `user_template.format()` 调用中传入新增字段**

在 `user_goal = user_template.format(...)` 中添加三个新参数。在第 273 行 `duration_hint=duration_hint,` 之后追加：

```python
        shot_position=shot_position_hint,
        prev_shot_goal=prev_shot_goal,
        next_shot_goal=next_shot_goal,
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/video_lab/routes/prompts.py
git commit -m "feat: add shot position and adjacent shot context to prompt template"
```

---

### Task 5: 验证

- [ ] **Step 1: 运行现有后端测试**

```bash
cd apps/backend && python -m pytest tests/ -x -q
```

期望：无新增失败（已存在的 test_character_sketch 失败不计）。

- [ ] **Step 2: 启动服务并手动验证**

```bash
./start.sh
```

打开任意镜头 prompt 页，点击「AI 生成 Prompt」，检查生成的 video_prompt 包含：
- 初始画面描述
- 时间线分段（0-1s / 1-3s 等）
- 起幅→落幅描述
- 如有对白，包含音色描述
- 末尾有英文 Technical keywords
- generate.txt 模板中的新字段无 KeyError

- [ ] **Step 3: Commit**

```bash
git commit -m "verify: video prompt v2 passes existing tests and manual check" --allow-empty
```

---

## Self-Review

- **Spec coverage:** 6 video_prompt 要素 ✓（Task 1），4 个模板字段 ✓（Tasks 2, 3, 4），3 处路由改动 ✓（Tasks 3, 4）
- **No placeholders:** 所有代码步骤包含完整代码
- **Type consistency:** `shot_position_hint`、`prev_shot_goal`、`next_shot_goal` 三个变量名在 Task 4 的 Step 1（定义）和 Step 2（使用）中一致
