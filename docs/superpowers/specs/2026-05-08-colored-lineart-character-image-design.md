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

### 1. Prompt 模板变更

**`video_lab/domain/assets/service.py` — `_build_character_image_prompt()`**：

当前 suffix：
```
铅笔素描风格、黑白线稿、清晰轮廓线条、纯色背景。
```

改为：
```
色铅笔手绘风格、全彩上色、清晰轮廓线条、平涂色块、纯色背景。非照片、非写实渲染。
```

**`video_lab/prompts/copilot_character/appearance_anchor.txt`** — 第 3 条更新：

当前：
```
3. **不要出现素描、线稿、插画、铅笔、黑白、纯色背景等画风词**——这不是用来生成图片的
```

改为：
```
3. **不要出现素描、线稿、插画、铅笔、色铅笔、彩色铅笔、纯色背景等画风词**——这不是用来生成图片的
```

### 2. 与现有系统协同

- **appearance_anchor**：末尾「恢复为真人影像」指令不变
- **generate.txt 规则 5**：sketch→real 规则不变，检测条件从「素描图片、黑白线稿、角色设定图或草图」扩展为「素描图片、线稿、手绘图、角色设定图或草图」（去掉「黑白」限定）
- **图一角色参考图**：角色不变，仅图片风格变化
- **_stylize_image**：保持 no-op 不变

### 3. 测试更新

`test_character_sketch.py`：
- `test_build_character_image_prompt_sketch_keywords` → 重命名为 `test_build_character_image_prompt_colored_lineart_keywords`
- 断言更新：存在 `色铅笔手绘风格`、`全彩上色`、`平涂色块`、`非照片`
- 断言更新：不存在 `电影级质感`、`均匀摄影棚灯光`、`铅笔素描`

### 4. 现有角色迁移

角色图需要重新生成。在角色编辑页触发 AI 重新生成角色图即可（使用新的 prompt template）。

## Files to change

| File | Change |
|------|--------|
| `video_lab/domain/assets/service.py` | 替换 `_build_character_image_prompt()` 中的风格关键词 suffix |
| `video_lab/prompts/copilot_character/appearance_anchor.txt` | 第 3 条过滤词新增「色铅笔、彩色铅笔」 |
| `tests/test_character_sketch.py` | 更新断言匹配新关键词 |
