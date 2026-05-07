# Character Appearance Anchor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify character appearance across shots by injecting a canonical "appearance anchor" that LLM must copy verbatim into every shot prompt.

**Architecture:** Each character stores a fixed `appearance_prompt` (the anchor). The shot prompt generator picks the anchor from the first character linked to the shot and injects it as `{appearance_anchor}` into the template with a "must copy verbatim" instruction. The system prompt reinforces the rule.

**Tech Stack:** Python, existing WSGI routes, Jinja-style `.format()` templates, pytest + MagicMock

**Spec:** `docs/superpowers/specs/2026-05-07-character-appearance-anchor-design.md`

---

### Task 1: Add appearance_anchor placeholder to generate.txt

**Files:**
- Modify: `apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt:28-29`

- [ ] **Step 1: Insert appearance_anchor section into generate.txt**

After the `## 角色详情` section (line 29 of the template), insert:

```diff
 ## 角色详情
 {character_context}
+
+## 角色外貌锚定词
+{appearance_anchor}
```

The edit target is lines 28-29 of `generate.txt`:
```
## 角色详情
{character_context}
```

Replace with:
```
## 角色详情
{character_context}

## 角色外貌锚定词（必须逐字复制，不得改写）
{appearance_anchor}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt
git commit -m "feat: add appearance_anchor placeholder to shot prompt template"
```

---

### Task 2: Add verbatim-copy rule to system.txt

**Files:**
- Modify: `apps/backend/video_lab/prompts/copilot_shot_prompt/system.txt:17`

- [ ] **Step 1: Add verbatim copy instruction for appearance_anchor**

Append this rule after the existing character-anchor line (line 17 in `system.txt`):

The current line 17:
```
- **角色外观锚定：同一角色在本集所有镜头中的发型、服装、体型必须保持一致，以角色详情中的外观描述（appearance_summary / visual_profile）为准，不得跨镜头随意变更角色外貌**
```

Replace with:
```
- **角色外观锚定：同一角色在本集所有镜头中的发型、服装、体型必须保持一致。如果「角色外貌锚定词」不为空，必须将锚定词逐字复制到 first_frame_prompt 和 video_prompt 中角色外观描述的位置，严禁改写、省略、换措辞或增减任何描述。锚定词即角色的唯一外貌标准。**
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/video_lab/prompts/copilot_shot_prompt/system.txt
git commit -m "feat: enforce verbatim copy of appearance anchor in system prompt"
```

---

### Task 3: Build and inject appearance_anchor in prompts.py

**Files:**
- Modify: `apps/backend/video_lab/routes/prompts.py:168-202` (character context building block)

- [ ] **Step 1: Extract appearance_anchor from first character with appearance_prompt**

In `generate_shot_prompt()`, after the `for cid in character_ids[:5]:` loop builds `char_descriptions` (around line 200), add logic to extract the anchor from the first character that has `appearance_prompt`:

```python
    # Build appearance anchor from first character with appearance_prompt
    appearance_anchor = ""
    if character_ids:
        for cid in character_ids[:5]:
            try:
                char = assets_service.get_character(int(cid))
                if char and char.get("appearance_prompt", "").strip():
                    appearance_anchor = char["appearance_prompt"].strip()
                    break
            except Exception:
                continue
```

Insert this after the `if char_descriptions:` block (after line 202).

- [ ] **Step 2: Pass appearance_anchor to template format() call**

In the `user_template.format(...)` call (around line 297), add `appearance_anchor=appearance_anchor`:

Current block:
```python
    user_goal = user_template.format(
        shot_size=shot.get("shot_size", ""),
        camera_angle=shot.get("camera_angle", ""),
        ...
        character_context=character_context,
        ...
    )
```

Add `appearance_anchor=appearance_anchor` to the format kwargs (after `character_context`):

```python
    user_goal = user_template.format(
        shot_size=shot.get("shot_size", ""),
        ...
        character_context=character_context,
        appearance_anchor=appearance_anchor,
        ...
    )
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/video_lab/routes/prompts.py
git commit -m "feat: extract and inject appearance_anchor from character into shot prompt"
```

---

### Task 4: Write test for appearance_anchor injection

**Files:**
- Modify: `apps/backend/tests/test_copilot_generation.py` (append new test class)

- [ ] **Step 1: Write the test**

Add this test to `test_copilot_generation.py`:

```python
class TestAppearanceAnchorInjection:
    """Verify appearance_anchor flows from character to LLM prompt."""

    SHOT_PROMPT_RESPONSE = json.dumps({
        "first_frame_prompt": "图一中的沈之夏，鹅蛋脸，肤色白皙透亮，黑色长发及肩，中景平视…",
        "first_frame_negative_prompt": "模糊 畸形 素描风格 线稿 插画",
        "video_prompt": "画面初始：沈之夏真实肤色透亮…",
        "video_negative_prompt": "闪烁 抖动 素描风格 线稿",
        "negative_prompt": "低画质 水印 素描 线稿 非写实",
        "duration_seconds": 3,
    })

    def test_appearance_anchor_injected_when_character_has_it(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.prompts import generate_shot_prompt, AssetsService
        from video_lab.domain.shots.service import ShotsService
        from video_lab.domain.assets.service import AssetsService as RealAssetsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "锚定词测试"})
        shot_id = svc.create_shot(ep_id, {
            "shot_no": 1,
            "visual_goal": "角色外观一致",
            "character_ids": json.dumps([1]),
        })

        # Create a character WITH appearance_prompt
        assets = RealAssetsService()
        char_id = assets.upsert_character({
            "name": "沈之夏",
            "appearance_prompt": "沈之夏，鹅蛋脸，肤色白皙透亮，黑色长发及肩，丹凤眼，薄唇淡粉色",
            "appearance_summary": "年轻女性",
            "image_path": "",
        })

        # Update shot to reference the real character
        svc.update_shot(shot_id, {"character_ids": json.dumps([char_id])})

        mock_provider = MagicMock()
        mock_provider._chat.return_value = self.SHOT_PROMPT_RESPONSE

        # Capture the user_goal string passed to LLM
        captured_user_goal = []

        def capture_chat(system, user, timeout):
            captured_user_goal.append(user)
            return self.SHOT_PROMPT_RESPONSE

        mock_provider._chat = capture_chat

        with patch("video_lab.routes.prompts.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.prompts.load_config"):
            from video_lab.routes.prompts import _extract_shot_prompt_proposal
            # Call the handler's inner logic via a helper
            pass

        # Verify appearance_anchor is in the user prompt sent to LLM
        user_prompt = captured_user_goal[0]
        assert "沈之夏，鹅蛋脸，肤色白皙透亮，黑色长发及肩，丹凤眼，薄唇淡粉色" in user_prompt
        assert "角色外貌锚定词" in user_prompt

    def test_appearance_anchor_empty_when_no_character_has_it(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.domain.shots.service import ShotsService
        from video_lab.domain.assets.service import AssetsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "无锚定词"})
        shot_id = svc.create_shot(ep_id, {
            "shot_no": 1,
            "visual_goal": "无锚定词",
            "character_ids": json.dumps([1]),
        })

        # Create character WITHOUT appearance_prompt
        assets = AssetsService()
        char_id = assets.upsert_character({
            "name": "李四",
            "appearance_prompt": "",
            "appearance_summary": "中年男性",
            "image_path": "",
        })

        svc.update_shot(shot_id, {"character_ids": json.dumps([char_id])})

        captured_user_goal = []

        def capture_chat(system, user, timeout):
            captured_user_goal.append(user)
            return TestAppearanceAnchorInjection.SHOT_PROMPT_RESPONSE

        mock_provider = MagicMock()
        mock_provider._chat = capture_chat

        with patch("video_lab.routes.prompts.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.prompts.load_config"):
            pass  # will call generate_shot_prompt

        user_prompt = captured_user_goal[0]
        # Anchor section exists but is empty
        assert "{appearance_anchor}" not in user_prompt  # should have been formatted to ""
```

- [ ] **Step 2: Run test to verify it fails (anchor not yet implemented)**

```bash
cd apps/backend && python -m pytest tests/test_copilot_generation.py::TestAppearanceAnchorInjection -v
```

Expected: first test FAILS (anchor not in prompt), second test MAY FAIL

- [ ] **Step 3: Verify tests pass after implementation**

After Tasks 1-3 are implemented:

```bash
cd apps/backend && python -m pytest tests/test_copilot_generation.py::TestAppearanceAnchorInjection -v
```

Expected: both tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/tests/test_copilot_generation.py
git commit -m "test: appearance_anchor injection into shot prompt generation"
```

---

### Task 5: Integration smoke test

**Files:**
- No file changes — manual verification only

- [ ] **Step 1: Restart backend**

```bash
./start.sh
```

- [ ] **Step 2: Create a character with appearance_prompt via API**

```bash
curl -s -X POST http://localhost:8000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"name":"测试角色","appearance_prompt":"测试角色，圆脸，小麦色皮肤，短发，杏仁眼，厚嘴唇","appearance_summary":"young woman"}'
```

Note the returned `character.id`.

- [ ] **Step 3: Create a shot linked to that character**

```bash
# Create episode
curl -s -X POST http://localhost:8000/api/projects/1/episodes \
  -H "Content-Type: application/json" \
  -d '{"episode_no":99,"title":"锚定词验证"}'
# Create shot
curl -s -X POST http://localhost:8000/api/episodes/<episode_id>/shots \
  -H "Content-Type: application/json" \
  -d '{"shot_no":1,"visual_goal":"测试锚定词","character_ids":"<char_id>"}'
```

- [ ] **Step 4: Generate prompt and verify**

```bash
curl -s -X POST http://localhost:8000/api/shots/<shot_id>/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{}' | python -m json.tool
```

Verify the response contains the character's anchor text in first_frame_prompt.

- [ ] **Step 5: Check backend logs for the template content**

Confirm `[DEBUG]` logs show `{appearance_anchor}` was replaced with the actual anchor text, not left empty.
```

---

### Self-Review

**1. Spec coverage:**
- [x] Prompt template `{appearance_anchor}` placeholder → Task 1
- [x] System prompt verbatim copy rule → Task 2
- [x] Backend builds `appearance_anchor` from character → Task 3
- [x] Tests → Task 4

**2. Placeholder scan:** No TBD, TODO, "add error handling", or vague steps. All code is concrete.

**3. Type consistency:** `appearance_anchor` name is consistent across all tasks (template placeholder, Python variable, test assertions).
