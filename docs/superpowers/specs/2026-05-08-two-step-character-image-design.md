# Two-Step Character Image Generation — Design Spec

## Problem

当前一步生成全彩线稿角色图，面部结构精度受限于线稿风格的 prompt。真人照片生成的面部更精准，但直接用作 Seedance 参考图会触发审核。

## Solution

两步生成：先生成真人照（高精度面部），再调用同一 API 将真人照转为彩色素描（通过审核）。前端并排展示两张图。

### Step 1 — 生成真人照

调用 ChatFire `/v1/images/generations`，text-to-image，prompt 为真人摄影风格：

```
全身角色参考图，{style}风格：{appearance_prompt}。写实真人摄影风格，真实肤色与皮肤纹理，自然光影，电影级人像质感，纯色背景。全身从头到脚，站立姿势，完整可见。
```

产出：`character_{id}_photo.png`，存入 `characters.photo_path`

### Step 2 — 转彩色素描

调用同一 API，传入真人照作为 `image` 参数，prompt：

```
将此照片转换为彩色铅笔素描风格。保留所有面部特征、五官比例、发型、服装和体态。柔和彩色铅笔笔触，细腻排线阴影，纸上手绘质感，纯色背景。非照片，非写实渲染。
```

产出：`character_{id}.png`，存入 `characters.image_path`（覆盖现有）

### 安全边界

- Step 1 真人照仅用于内部 Step 2 输入，不传入 Seedance
- Step 2 彩色素描有明显手绘笔触和纸张质感，无摄影特征，审核安全
- Step 2 prompt 中「保留面部特征、五官比例、发型」确保身份不漂移

## DB Migration

`characters` 表新增：

```sql
ALTER TABLE characters ADD COLUMN photo_path TEXT DEFAULT '';
```

## Backend Changes

### 1. Prompt 模板

新增 2 个模板文件：

**`prompts/character_photo/prompt.txt`**：
```
全身角色参考图，{style}风格：{appearance_prompt}。写实真人摄影风格，真实肤色与皮肤纹理，自然光影，电影级人像质感，纯色背景。全身从头到脚，站立姿势，完整可见。
```

**`prompts/character_sketchify/prompt.txt`**：
```
将此照片转换为彩色铅笔素描风格。保留所有面部特征、五官比例、发型、服装和体态。柔和彩色铅笔笔触，细腻排线阴影，纸上手绘质感，纯色背景。非照片，非写实渲染。
```

### 2. `domain/assets/service.py`

`generate_character_image()` 改为两步：

1. 构建真人照 prompt → 调用 `providers["image"].generate_character_image()` → 得 `photo_path`
2. 以 `photo_path` 为 `image` 参数，构建素描 prompt → 调用同一 API → 得 `image_path`
3. 两个路径分别写入 `photo_path` 和 `image_path`

### 3. `repository.py`

`update_character()` 字段白名单新增 `photo_path`。

### 4. Routes

`GET /api/projects/{id}/characters` 和 `GET /api/projects/{id}/characters/{charId}` 返回 `photo_url`（`/assets/{photo_path}`）。

## Frontend Changes

### 1. `CharacterCard.tsx`

- 双图并排：左为真人照，右为彩色素描
- 同高，各占 50% 宽度，`object-fit: cover`
- 点击任一张图打开 `ImagePreview` lightbox

### 2. `characters/[characterId]/page.tsx`

- 侧边栏 filmstrip 展示两张图（真人照在上，素描在下）
- 点击切换主预览区
- 「角色卡片」tab 中并排展示两张

## Files to Change

| File | Change |
|------|--------|
| `video_lab/db.py` | `photo_path` 列 |
| `video_lab/repository.py` | `photo_path` 读写 + 白名单 |
| `video_lab/domain/assets/service.py` | 两步生成逻辑 |
| `video_lab/prompts/character_photo/prompt.txt` | 新增真人照 prompt |
| `video_lab/prompts/character_sketchify/prompt.txt` | 新增风格转换 prompt |
| `video_lab/routes/__init__.py` | 返回 `photo_url` |
| `components/CharacterCard.tsx` | 并排双图 |
| `app/projects/[id]/characters/[characterId]/page.tsx` | 侧边栏双图 |
| `tests/` | 测试更新 |
