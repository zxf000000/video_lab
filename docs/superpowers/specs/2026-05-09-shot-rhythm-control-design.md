# Shot Rhythm Control — Design Spec

## Overview

给镜头生成系统增加可调节的节奏档位。用户每次发起生成时传 `rhythm_level` 参数，系统通过 prompt 注入影响 AI 输出的节奏风格，不改代码硬约束。

## Rhythm Levels

| Level | 视频时长 | 内部子段落数 | 转场手法 | 镜头时长(设计) | 镜头数量 |
|-------|---------|------------|---------|-------------|---------|
| `fast` | 4-5s | 2-3 | 快切/快摇 | 1500-4000ms, 复合≤6000 | 6-12 |
| `ultra_fast` | 4-5s | 3-4 | 甩镜/whip pan | 1000-3000ms, 复合≤4000 | 8-15 |
| `frenzy` | 4s | 4-5+ | 残影/跳切/频闪/抽帧 | 800-2000ms, 复合≤2500 | 10-20 |
| (default) | 2-8s | 2-3 | 标准 | 3000-8000ms, 复合≤12000 | 4-10 |

关键约束：视频模型最短时长 4s。快节奏不是缩短视频本身，而是提高 4s 内的动作/情绪密度。

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `routes/generation_tasks.py` | 接收 `rhythm_level`，构建 `rhythm_section` 传入 `copilot_shot/generate.txt` 模板 |
| 2 | `routes/prompts.py` | 接收 `rhythm_level`，构建 `rhythm_section` 传入 `copilot_shot_prompt/generate.txt` 模板 |
| 3 | `copilot_shot/generate.txt` | 新增 `{rhythm_section}` 占位符 |
| 4 | `copilot_shot_prompt/generate.txt` | 新增 `{rhythm_section}` 占位符 |

`system.txt` 文件不改。节奏指令通过 user message 注入，LLM 会自然遵循 user message 中的具体指令覆盖 system prompt 默认规则。

## Prompt Injection Text

### Shot Design Stage (`copilot_shot/`)

**fast:**
> 本集采用「快节奏」风格。镜头预估时长缩短至 1500-4000ms，复合运镜≤6000ms。建议镜头数量 6-12 个。连续动作合并阈值收紧至 6 秒。节奏曲线整体偏快，仅开场第一个镜头稍缓建立情境。facial_emotion 要求表情变化明显、情绪转折快，不做冗长铺垫。dialogue_excerpt 对白语速加快，语气标注体现急促感。

**ultra_fast:**
> 本集采用「极快节奏」风格。镜头预估时长 1000-3000ms，复合运镜≤4000ms。建议镜头数量 8-15 个。连续动作合并阈值收紧至 4 秒。节奏全程快速，无缓起阶段。单个镜头内允许表情急剧反转（如冷笑→暴怒在同一镜头内）。对白语速急促、几乎无停顿。运镜以快推/快摇/甩镜头为主，camera_motion 中可标注「快速」前缀。facial_emotion 中允许标注「瞬间变脸」「表情急转」等极端描述。

**frenzy:**
> 本集采用「癫狂节奏」风格。镜头预估时长 800-2000ms，复合运镜≤2500ms。建议镜头数量 10-20 个。连续动作一律切分，不做合并。节奏全程极限无间歇。表情瞬息万变，单镜头内可标注「狂喜→暴怒→冷漠」等多阶段反差。运镜以甩镜、快摇、跳切为主。camera_motion 可标注「残影甩镜」「频闪快切」等非常规手法。

### Prompt Generation Stage (`copilot_shot_prompt/`)

**fast:**
> 本镜采用「快节奏」风格。由于视频模型最短时长为 4 秒，本镜须在 4-5 秒内串联 2-3 个动作/情绪子段落，使用快切或快摇作为段落间转场。时间分段每个阶段不超过 2 秒。对白在第 1 秒内开始，语速快无拖腔。运镜速度以「快速」「急促」为主。Technical keywords 中加入 quick cuts、fast pacing。

**ultra_fast:**
> 本镜采用「极快节奏」风格。本镜须在 4-5 秒内串联 3-4 个动作/情绪子段落，使用甩镜、whip pan 作为段落间转场。时间分段每个阶段不超过 1.5 秒。表情在相邻阶段间急剧反转。对白在 0.5 秒内开始，语速急促如连珠炮。运镜速度以「急速」「快甩」为主。video_negative_prompt 中不禁止 motion blur、拖影，改为禁止画面静止、缓慢运镜。Technical keywords 中加入 whip pan、speed lines、rapid cuts。

**frenzy:**
> 本镜采用「癫狂节奏」风格。本镜须在 4 秒内串联 4-5 个以上动作/情绪微瞬间，使用残影拖影、跳切、抽帧、频闪作为转场。时间分段每阶段不超过 1 秒，允许单阶段仅 0.5 秒。表情瞬息万变、极端反差。对白碎片化，可多角色打断重叠。运镜以残影甩镜、频闪快切为主。video_negative_prompt 中禁止画面静止、缓慢运镜、平滑过渡、写实运动模糊，允许将 motion blur 作为风格元素保留。Technical keywords 中加入 strobing、smash cut、motion blur、frame skipping、glitch effect。

## Code Logic

### `generation_tasks.py`

在 `_stream_llm_response` 中接收 `rhythm_level`，字典映射到对应文本，作为 `rhythm_section` 传入 `user_template.format()`。

### `prompts.py` — `generate_shot_prompt`

从请求 payload 中读取 `rhythm_level`，同上构建 `rhythm_section`，传入 `user_template.format(rhythm_section=rhythm_section, ...)`。

两处共用同一个 `_build_rhythm_section(rhythm_level: str) -> str` 工具函数，放在 `routes/__init__.py` 或各自模块内。

## Backward Compatibility

- `rhythm_level` 为空或不传 → `rhythm_section` 为空字符串
- 所有现有 prompt 行为不变
- 前端可后续加 UI，不急

## Test Plan

1. 单元测试：`_build_rhythm_section` 返回正确文本
2. Prompt 集成测试：验证 `{rhythm_section}` 占位符存在于所有 4 个模板
3. 快照测试：每个 level 构建的 `user_goal` 字符串包含对应的节奏指令
4. 向后兼容：不传 `rhythm_level` 时生成的 prompt 与当前一致
