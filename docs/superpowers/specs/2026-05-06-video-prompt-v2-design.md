# Video Prompt V2 — 第 0 层优化设计

## Context

当前 `copilot_shot_prompt/system.txt` 对 video_prompt 的要求只有一句话：
> 描述从首帧生成视频的运镜方式、人物动作、画面变化。简洁，适合 3-5 秒片段。

导致生成的 video_prompt 缺失：初始画面状态、时间线分段、运镜起幅落幅、对白与音色、英文关键词。

用户要求渐进式迭代，第 0 层先重写 system.txt video_prompt 规则，补 generate.txt 缺失字段，在路由中补齐数据。

## 改动清单

### A. system.txt — video_prompt 规则重写

将当前 1 句话替换为结构化 6 要素：

1. **初始画面（第 0 秒）** — 人物位置/朝向/姿态、环境状态、区分静/动元素
2. **时间线分段** — ≤2 秒 1 阶段，3-4 秒 2 阶段，5-8 秒 3 阶段，标注时间范围
3. **运镜起幅→落幅** — 起点/终点机位 + 速度 + 是否匀速
4. **对白落地与音色** — 台词时间 + 说话人 + 音色（来自角色 speech_style）+ 口型/表情 + 说完后反应；无对白可省略
5. **画面变化要素** — 主动变化 vs 被动变化
6. **英文技术关键词** — 末尾追加一行英文

### B. generate.txt — 新增 4 个模板字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `{prev_shot_goal}` | 同 episode 上一镜 visual_goal | 首镜传"无（本场第一个镜头）" |
| `{next_shot_goal}` | 同 episode 下一镜 visual_goal | 末镜传"无（本场最后一个镜头）" |
| `{shot_position}` | scene_block 内按 shot_no 排序 | "S1 的第 3 个镜头" |
| 角色上下文 | 补 `speech_style` + `personality_tags` | 从 DB characters 表取 |

### C. routes/prompts.py — `generate_shot_prompt()` 3 处改动

1. **角色上下文补字段** — 在构建 `char_descriptions` 时追加 `speech_style` 和 `personality_tags`
2. **查相邻镜头** — 同 episode 按 shot_no 排序，取前后镜头的 visual_goal
3. **算镜头位置** — 同 scene_block 内计数，得到当前镜头序号

## 不涉及

- 前端页面不做改动
- DB schema 不做改动
- 视频/首帧生成逻辑不做改动
- 第 1-3 层优化点留后续迭代

## 验证

1. `python -m pytest apps/backend/tests/ -x -q` — 无新增失败
2. 打开任意镜头 prompt 页，点击「AI 生成 Prompt」，检查 video_prompt 是否包含 6 要素
3. 人工抽查：有对白的镜头 prompt 是否包含音色描述，是否引用了前后镜头上下文
