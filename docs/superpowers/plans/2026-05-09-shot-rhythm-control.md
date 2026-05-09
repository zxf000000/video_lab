# Shot Rhythm Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rhythm_level parameter (fast/ultra_fast/frenzy) to shot generation and prompt generation APIs, injecting pace-specific instructions via prompt templates.

**Architecture:** A shared `_build_rhythm_section()` utility maps rhythm_level to pre-written Chinese prompt text. This text is injected via `{rhythm_section}` placeholder in `generate.txt` templates. Code changes: 2 route files + 2 prompt templates. system.txt files are NOT modified.

**Tech Stack:** Python 3, WSGI route handlers, string formatting

---

## File Map

| File | Role |
|------|------|
| `routes/__init__.py` | New `_build_rhythm_section()` utility |
| `routes/copilot.py` | `_compile_messages` gains `rhythm_section` param |
| `routes/generation_tasks.py` | Extract `rhythm_level` from payload, thread through executor chain to shot generation |
| `routes/prompts.py` | Extract `rhythm_level` from payload in `generate_shot_prompt` |
| `prompts/copilot_shot/generate.txt` | Add `{rhythm_section}` placeholder |
| `prompts/copilot_shot_prompt/generate.txt` | Add `{rhythm_section}` placeholder |
| `tests/test_rhythm_section.py` | Unit tests for `_build_rhythm_section` |

---

### Task 1: Add `_build_rhythm_section` utility to `routes/__init__.py`

**Files:**
- Modify: `apps/backend/video_lab/routes/__init__.py` (after `parse_qs_param`, before serializers)

- [ ] **Step 1: Add the utility function**

Add this function after `parse_qs_param` (line 92) and before `_parse_json_field` (line 94):

```python
# ── Rhythm section builder ─────────────────────────────────────────
_RHYTHM_SECTIONS: dict[str, str] = {
    "fast": (
        "本集采用「快节奏」风格。镜头预估时长缩短至 1500-4000ms，复合运镜≤6000ms。"
        "建议镜头数量 6-12 个。连续动作合并阈值收紧至 6 秒。"
        "节奏曲线整体偏快，仅开场第一个镜头稍缓建立情境。"
        "facial_emotion 要求表情变化明显、情绪转折快，不做冗长铺垫。"
        "dialogue_excerpt 对白语速加快，语气标注体现急促感。"
    ),
    "ultra_fast": (
        "本集采用「极快节奏」风格。镜头预估时长 1000-3000ms，复合运镜≤4000ms。"
        "建议镜头数量 8-15 个。连续动作合并阈值收紧至 4 秒。"
        "节奏全程快速，无缓起阶段。单个镜头内允许表情急剧反转（如冷笑→暴怒在同一镜头内）。"
        "对白语速急促、几乎无停顿。运镜以快推/快摇/甩镜头为主，"
        "camera_motion 中可标注「快速」前缀。"
        "facial_emotion 中允许标注「瞬间变脸」「表情急转」等极端描述。"
    ),
    "frenzy": (
        "本集采用「癫狂节奏」风格。镜头预估时长 800-2000ms，复合运镜≤2500ms。"
        "建议镜头数量 10-20 个。连续动作一律切分，不做合并。"
        "节奏全程极限无间歇。表情瞬息万变，"
        '单镜头内可标注「狂喜→暴怒→冷漠」等多阶段反差。'
        "运镜以甩镜、快摇、跳切为主。"
        "camera_motion 可标注「残影甩镜」「频闪快切」等非常规手法。"
    ),
}

_RHYTHM_SECTIONS_PROMPT: dict[str, str] = {
    "fast": (
        "本镜采用「快节奏」风格。由于视频模型最短时长为 4 秒，"
        "本镜须在 4-5 秒内串联 2-3 个动作/情绪子段落，使用快切或快摇作为段落间转场。"
        "时间分段每个阶段不超过 2 秒。对白在第 1 秒内开始，语速快无拖腔。"
        "运镜速度以「快速」「急促」为主。"
        "Technical keywords 中加入 quick cuts、fast pacing。"
    ),
    "ultra_fast": (
        "本镜采用「极快节奏」风格。本镜须在 4-5 秒内串联 3-4 个动作/情绪子段落，"
        "使用甩镜、whip pan 作为段落间转场。时间分段每个阶段不超过 1.5 秒。"
        "表情在相邻阶段间急剧反转。对白在 0.5 秒内开始，语速急促如连珠炮。"
        "运镜速度以「急速」「快甩」为主。"
        "video_negative_prompt 中不禁止 motion blur、拖影，改为禁止画面静止、缓慢运镜。"
        "Technical keywords 中加入 whip pan、speed lines、rapid cuts。"
    ),
    "frenzy": (
        "本镜采用「癫狂节奏」风格。本镜须在 4 秒内串联 4-5 个以上动作/情绪微瞬间，"
        "使用残影拖影、跳切、抽帧、频闪作为转场。时间分段每阶段不超过 1 秒，允许单阶段仅 0.5 秒。"
        "表情瞬息万变、极端反差。对白碎片化，可多角色打断重叠。"
        "运镜以残影甩镜、频闪快切为主。"
        "video_negative_prompt 中禁止画面静止、缓慢运镜、平滑过渡、写实运动模糊，"
        "允许将 motion blur 作为风格元素保留。"
        "Technical keywords 中加入 strobing、smash cut、motion blur、frame skipping、glitch effect。"
    ),
}


def build_rhythm_section(rhythm_level: str, *, stage: str = "shot") -> str:
    """Build rhythm injection string for prompt templates.

    Args:
        rhythm_level: One of 'fast', 'ultra_fast', 'frenzy', or empty string.
        stage: 'shot' for shot design stage, 'prompt' for prompt generation stage.

    Returns:
        Rhythm instruction string, or empty string if level is invalid/empty.
    """
    if not rhythm_level:
        return ""
    if stage == "prompt":
        return _RHYTHM_SECTIONS_PROMPT.get(rhythm_level, "")
    return _RHYTHM_SECTIONS.get(rhythm_level, "")
```

- [ ] **Step 2: Verify syntax**

```bash
cd apps/backend && python3 -c "from video_lab.routes import build_rhythm_section; print(build_rhythm_section('fast', stage='shot')[:20])"
```

Expected: prints first 20 chars of the fast rhythm text.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/video_lab/routes/__init__.py
git commit -m "feat: add build_rhythm_section utility for rhythm-controlled shot generation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Add `{rhythm_section}` placeholder to prompt templates

**Files:**
- Modify: `apps/backend/video_lab/prompts/copilot_shot/generate.txt`
- Modify: `apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt`

- [ ] **Step 1: Add placeholder to copilot_shot/generate.txt**

Append this line at the end of the file (after line 14):

```
15. {rhythm_section}
```

Use Edit to append after line 14 (`项目 ID: {project_id}` wait — let me re-read the file). The file ends with `{context_json}`. Add `{rhythm_section}` as the last line:

Edit file, add after the last line:

```
{rhythm_section}
```

- [ ] **Step 2: Add placeholder to copilot_shot_prompt/generate.txt**

Append this line at the end of the file (after line 51 `项目 ID: {project_id}`):

```
{rhythm_section}
```

- [ ] **Step 3: Verify placeholders exist**

```bash
grep 'rhythm_section' apps/backend/video_lab/prompts/copilot_shot/generate.txt apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt
```

Expected: both files contain `{rhythm_section}`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/video_lab/prompts/copilot_shot/generate.txt apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt
git commit -m "feat: add rhythm_section placeholder to shot and prompt generate templates

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Thread `rhythm_level` through shot generation chain

**Files:**
- Modify: `apps/backend/video_lab/routes/copilot.py` — `_compile_messages` signature
- Modify: `apps/backend/video_lab/routes/generation_tasks.py` — `_stream_llm_response`, `_run_generate_shots`, `_submit_copilot_task`

- [ ] **Step 1: Add `rhythm_section` parameter to `_compile_messages`**

In `routes/copilot.py`, change the function signature (line 43-51):

```python
def _compile_messages(
    messages: list[dict[str, str]],
    *,
    user_template: str,
    context: dict,
    user_goal: str,
    project_id: int,
    entity_id: int | None,
    rhythm_section: str = "",
) -> list[dict[str, str]]:
    compiled_goal = user_goal or "请基于当前上下文生成一版可直接回填的结构化建议。"
    context_json = json.dumps(context, ensure_ascii=False, indent=2)
    compiled_user = user_template.format(
        user_goal=compiled_goal,
        context_json=context_json,
        project_id=project_id,
        entity_id=entity_id or "",
        rhythm_section=rhythm_section,
    )
```

- [ ] **Step 2: Add `rhythm_level` parameter to `_stream_llm_response`**

In `generation_tasks.py`, change `_stream_llm_response` signature (line 25) from:

```python
def _stream_llm_response(module_type: str, context: dict, messages: list[dict], project_id: int, entity_id: int) -> str:
```

to:

```python
def _stream_llm_response(module_type: str, context: dict, messages: list[dict], project_id: int, entity_id: int, rhythm_level: str = "") -> str:
```

And add rhythm_section construction before `_compile_messages` call (after line 36, before line 37):

```python
    from . import build_rhythm_section
    rhythm_section = build_rhythm_section(rhythm_level, stage="shot")
```

And add `rhythm_section=rhythm_section` to the `_compile_messages` call (line 37-44):

```python
    compiled_messages = _compile_messages(
        messages,
        user_template=user_template,
        context=context,
        user_goal=user_goal,
        project_id=project_id,
        entity_id=entity_id,
        rhythm_section=rhythm_section,
    )
```

- [ ] **Step 3: Add `rhythm_level` parameter to `_run_generate_shots`**

Change `_run_generate_shots` signature (line 365) from:

```python
def _run_generate_shots(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict]) -> None:
```

to:

```python
def _run_generate_shots(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict], rhythm_level: str = "") -> None:
```

And pass `rhythm_level` to `_stream_llm_response` call (line 386):

```python
        full_text = _stream_llm_response("shot", context, messages, project_id, episode_id, rhythm_level=rhythm_level)
```

- [ ] **Step 4: Extract `rhythm_level` in `_submit_copilot_task`**

In `_submit_copilot_task` (line 410), extract `rhythm_level` from payload after the `messages` parse:

```python
    rhythm_level = str(payload.get("rhythm_level", "") or "").strip()
```

And pass it to the executor dispatch (line 436):

```python
    _copilot_executor.submit(executor_fn, task_id, episode_id_int, project_id, context, messages, rhythm_level)
```

Note: `_run_generate_screenplay` and `_run_generate_scenes` will receive `rhythm_level` as an extra positional arg but their signatures don't accept it. We need to also update their signatures to accept and ignore it.

- [ ] **Step 5: Add `rhythm_level` param to screenplay and scene executors (so they accept the extra arg)**

Update `_run_generate_screenplay` signature (line 72):

```python
def _run_generate_screenplay(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict], rhythm_level: str = "") -> None:
```

Update `_run_generate_scenes` signature (line 152):

```python
def _run_generate_scenes(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict], rhythm_level: str = "") -> None:
```

- [ ] **Step 6: Verify syntax and imports**

```bash
cd apps/backend && python3 -c "from video_lab.routes.generation_tasks import _stream_llm_response; print('OK')"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/video_lab/routes/copilot.py apps/backend/video_lab/routes/generation_tasks.py
git commit -m "feat: thread rhythm_level through shot generation executor chain

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Add `rhythm_level` to shot prompt generation endpoint

**Files:**
- Modify: `apps/backend/video_lab/routes/prompts.py`

- [ ] **Step 1: Extract `rhythm_level` and build `rhythm_section`**

In `generate_shot_prompt` (around line 289), after `payload = parse_json(environ)` and `with_first_frame = ...`, add:

```python
    rhythm_level = str(payload.get("rhythm_level", "") or "").strip()
    from . import build_rhythm_section
    rhythm_section = build_rhythm_section(rhythm_level, stage="prompt")
```

- [ ] **Step 2: Add `rhythm_section` to template format call**

In the `user_goal = user_template.format(...)` call (line 304-325), add `rhythm_section=rhythm_section,` as the last keyword argument before the closing `)`:

```python
    user_goal = user_template.format(
        ...
        prev_camera_angle=prev_camera_angle,
        rhythm_section=rhythm_section,
    )
```

- [ ] **Step 3: Verify syntax**

```bash
cd apps/backend && python3 -c "from video_lab.routes.prompts import generate_shot_prompt; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/video_lab/routes/prompts.py
git commit -m "feat: add rhythm_level support to shot prompt generation endpoint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Write tests

**Files:**
- Create: `apps/backend/video_lab/tests/test_rhythm_section.py`

- [ ] **Step 1: Write unit tests for `build_rhythm_section`**

```python
from __future__ import annotations

import sys
from pathlib import Path

# Add parent to path so we can import video_lab
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from video_lab.routes import build_rhythm_section


def test_build_rhythm_section_empty():
    """Empty or invalid rhythm_level returns empty string."""
    assert build_rhythm_section("") == ""
    assert build_rhythm_section("nonexistent") == ""
    assert build_rhythm_section("normal") == ""


def test_build_rhythm_section_fast_shot_stage():
    """fast level returns shot design stage text."""
    result = build_rhythm_section("fast", stage="shot")
    assert "快节奏" in result
    assert "1500-4000ms" in result
    assert "6-12" in result


def test_build_rhythm_section_ultra_fast_shot_stage():
    """ultra_fast level returns shot design stage text."""
    result = build_rhythm_section("ultra_fast", stage="shot")
    assert "极快节奏" in result
    assert "1000-3000ms" in result
    assert "8-15" in result
    assert "瞬间变脸" in result


def test_build_rhythm_section_frenzy_shot_stage():
    """frenzy level returns shot design stage text."""
    result = build_rhythm_section("frenzy", stage="shot")
    assert "癫狂节奏" in result
    assert "800-2000ms" in result
    assert "10-20" in result
    assert "残影甩镜" in result


def test_build_rhythm_section_fast_prompt_stage():
    """fast level returns prompt generation stage text."""
    result = build_rhythm_section("fast", stage="prompt")
    assert "快节奏" in result
    assert "4-5 秒" in result
    assert "2-3 个动作" in result
    assert "quick cuts" in result


def test_build_rhythm_section_ultra_fast_prompt_stage():
    """ultra_fast level returns prompt generation stage text."""
    result = build_rhythm_section("ultra_fast", stage="prompt")
    assert "极快节奏" in result
    assert "3-4 个动作" in result
    assert "whip pan" in result
    assert "motion blur" in result


def test_build_rhythm_section_frenzy_prompt_stage():
    """frenzy level returns prompt generation stage text."""
    result = build_rhythm_section("frenzy", stage="prompt")
    assert "癫狂节奏" in result
    assert "4-5 个以上" in result
    assert "残影拖影" in result
    assert "glitch effect" in result
    assert "0.5 秒" in result


def test_default_stage_is_shot():
    """Default stage is 'shot'."""
    result = build_rhythm_section("fast")
    assert "镜头预估时长" in result
    # Prompt stage text should NOT appear
    assert "quick cuts" not in result
```

- [ ] **Step 2: Run tests**

```bash
cd apps/backend && python3 -m pytest video_lab/tests/test_rhythm_section.py -v
```

Expected: 8 tests pass.

- [ ] **Step 3: Verify placeholder existence in templates (integration check)**

```bash
grep -q '{rhythm_section}' apps/backend/video_lab/prompts/copilot_shot/generate.txt && echo "copilot_shot OK" || echo "copilot_shot MISSING"
grep -q '{rhythm_section}' apps/backend/video_lab/prompts/copilot_shot_prompt/generate.txt && echo "copilot_shot_prompt OK" || echo "copilot_shot_prompt MISSING"
```

Expected: both print "OK".

- [ ] **Step 4: Run full test suite to check no regressions**

```bash
cd apps/backend && python3 -m pytest video_lab/tests/ -v
```

Expected: all existing tests pass, 8 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/video_lab/tests/test_rhythm_section.py
git commit -m "test: add unit tests for build_rhythm_section rhythm control

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Restart server**

```bash
cd apps/backend && ./start.sh
```

- [ ] **Step 2: Test shot prompt generation with rhythm_level via curl**

```bash
curl -s -X POST http://localhost:8000/api/shots/<shot_id>/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{"rhythm_level": "fast"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('duration_seconds','NO DURATION'))"
```

Expected: returns a valid prompt JSON (may fail if LLM key not configured, but should not crash on rhythm_level param).

- [ ] **Step 3: Test backward compatibility (no rhythm_level)**

```bash
curl -s -X POST http://localhost:8000/api/shots/<shot_id>/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'first_frame_prompt' in d else d.get('error','FAIL'))"
```

Expected: `OK` or a non-rhythm-related error (same behavior as before).
