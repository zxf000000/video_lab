# Character Appearance Anchor — Design Spec

## Problem

同一角色的素描参考图在不同镜头的 AI 视频中外观不一致。根因：LLM 每次生成 `first_frame_prompt` / `video_prompt` 时用自己的措辞重新描述角色外貌，导致不同镜头对同一角色的描述漂移。

## Design

### 1. 角色外貌锚定词

`characters.appearance_prompt`（已有字段）定位升级：从「参考提示」变为「逐字锚定词」。

- 每个角色保存一段**固定的、细节充分的中文外貌描述**
- 涵盖：脸型、五官、肤色、发型发色、体型、服装、标志性特征
- 锚定词在角色创建时生成一次，之后锁定不变
- 所有镜头复用这段文字

### 2. Prompt 模板修改

**`prompts/copilot_shot_prompt/system.txt`**：
- 新增规则：角色锚定词必须逐字复制到 first_frame_prompt 和 video_prompt，严禁改写、省略或换措辞

**`prompts/copilot_shot_prompt/generate.txt`**：
- 角色详情区域新增 `{appearance_anchor}` 占位符
- 标注「必须逐字复制」指令
- 第一个角色的外观锚定词作为该镜头所有角色的统一锚定

### 3. 后端拼接逻辑

**`routes/prompts.py` — `generate_shot_prompt()`**：
- 构建 `appearance_anchor` 字符串：从 shot 关联的角色中取第一个有 `appearance_prompt` 的角色，将其 `appearance_prompt` 作为锚定词
- 注入 `user_template.format(appearance_anchor=appearance_anchor, ...)`

### 4. 角色管理

- 角色编辑页增加「AI 生成锚定词」按钮，根据角色名 + 已有描述 + 素描图一次性生成
- 生成后锁定，手动修改需确认

## Files to change

| File | Change |
|------|--------|
| `prompts/copilot_shot_prompt/system.txt` | 加「逐字复制锚定词」规则 |
| `prompts/copilot_shot_prompt/generate.txt` | 加 `{appearance_anchor}` 占位符 |
| `routes/prompts.py` | 构建 `appearance_anchor`，注入模板 |
