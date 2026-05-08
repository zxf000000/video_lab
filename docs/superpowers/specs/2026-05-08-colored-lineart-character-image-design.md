# Colored Line Art Character Image — Design Spec

## Problem

Seedance 2.0 真人审核会拦截包含「摄影级真实感」特征的输入图片。当前角色图使用黑白铅笔素描，审核安全但缺少肤色、发色、瞳色、服装色等信息，Seedance 视频生成时只能依赖文本描述还原色彩，不同镜头间色彩一致性依赖 appearance_anchor 文本质量，容易出现色彩漂移。

## Solution

角色参考图从「黑白铅笔素描」切换为「全彩线稿」，在保持「明显是画不是照片」的前提下，向 Seedance 提供完整色彩信息。

### 安全边界

Seedance 审核检测的是**摄影质感**（皮肤毛孔纹理、自然光影衰减、镜头景深），不检测颜色。

**安全特征**（保留）：
- 清晰轮廓线 / 描边
- 平涂色块
- 纯色背景
- 纸张/笔触纹理

**触审特征**（避免）：
- 写实皮肤纹理
- 自然软阴影
- 镜头景深
- 真实面料质感
- HDR 调色

## Design

### 1. 图片生成 Prompt 层

**`video_lab/domain/assets/service.py`**：

`CHARACTER_SKETCH_REFERENCE_INSTRUCTION` 常量（第 10-14 行）：
```
当前：生成角色素描参考图：铅笔素描风格、黑白线稿、清晰轮廓线条、纯色背景。
改为：生成角色彩色线稿参考图：色铅笔手绘风格、全彩上色、清晰轮廓线条、平涂色块、纯色背景。不要生成真人照片、彩色写真、电影剧照或写实成片。目标是稳定角色五官、体型、发型、服装和整体轮廓，供后续首帧/视频生成时恢复为真实真人影像。
```

`_build_character_image_prompt()` suffix：
```
当前：铅笔素描风格、黑白线稿、清晰轮廓线条、纯色背景。
改为：色铅笔手绘风格、全彩上色、清晰轮廓线条、平涂色块、纯色背景。非照片、非写实渲染。
```

**`video_lab/prompts/character_image/prompt.txt`**（ChatFire 提供商路径使用）：
```
当前：全身角色素描参考图，{style}风格：{appearance_prompt}。铅笔素描风格，黑白线稿，…
改为：全身角色彩色线稿参考图，{style}风格：{appearance_prompt}。色铅笔手绘风格，全彩上色，平涂色块，…
```

### 2. LLM Copilot Prompt 层

以下 4 个文件指示 LLM 生成角色 `image_prompt`，需从「pencil sketch / line art」改为「colored pencil / line art」：

| 文件 | 变更 |
|------|------|
| `copilot_character/system.txt` | `image_prompt 必须是铅笔素描/线稿风格（pencil sketch / line art）` → `色铅笔线稿风格（colored pencil / line art），平涂色块` |
| `copilot_character/generate.txt` | `pencil sketch, line art, solid background.` → `colored pencil, line art, flat colors, solid background.` |
| `copilot_character/fill_missing.txt` | 同上 |
| `copilot_character/optimize_prompt.txt` | 同上 |

**`copilot_character/appearance_anchor.txt`** — 第 3 条：
```
当前：不要出现素描、线稿、插画、铅笔、黑白、纯色背景等画风词
改为：不要出现素描、线稿、插画、铅笔、色铅笔、彩色铅笔、纯色背景等画风词
```

### 3. Shot Prompt 层

**`copilot_shot_prompt/generate.txt`** — 规则 5，去掉「黑白」限定以匹配全彩线稿：
```
当前：如果任一角色图片是素描图片、黑白线稿、角色设定图或草图
改为：如果任一角色图片是素描图片、线稿、手绘图、角色设定图或草图
```

### 4. 测试更新

`test_character_sketch.py`：
- `test_build_character_image_prompt_sketch_keywords` → 重命名为 `test_build_character_image_prompt_colored_lineart_keywords`
- 断言存在：`色铅笔手绘风格`、`全彩上色`、`平涂色块`、`非照片`
- 断言不存在：`电影级质感`、`均匀摄影棚灯光`、`铅笔素描`

### 5. 现有角色迁移

角色图需要重新生成。在角色编辑页触发 AI 重新生成角色图即可（使用新的 prompt template）。

## Files to change

| File | Change |
|------|--------|
| `video_lab/domain/assets/service.py` | `CHARACTER_SKETCH_REFERENCE_INSTRUCTION` + `_build_character_image_prompt()` suffix 替换 |
| `video_lab/prompts/character_image/prompt.txt` | ChatFire 模板风格关键词替换 |
| `video_lab/prompts/copilot_character/system.txt` | LLM 指令：pencil sketch → colored pencil line art |
| `video_lab/prompts/copilot_character/generate.txt` | 同上 |
| `video_lab/prompts/copilot_character/fill_missing.txt` | 同上 |
| `video_lab/prompts/copilot_character/optimize_prompt.txt` | 同上 |
| `video_lab/prompts/copilot_character/appearance_anchor.txt` | 过滤词新增「色铅笔、彩色铅笔」 |
| `video_lab/prompts/copilot_shot_prompt/generate.txt` | 规则 5 去掉「黑白」限定 |
| `tests/test_character_sketch.py` | 更新断言匹配新关键词 |
