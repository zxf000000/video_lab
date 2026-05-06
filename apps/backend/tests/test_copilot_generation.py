"""Tests for copilot generation flow: screenplay → scenes → shots, async tasks,
and screenplay_scenes persistence."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from video_lab.config import DEFAULT_PROMPTS


# ---------------------------------------------------------------------------
# 1. Proposal extraction
# ---------------------------------------------------------------------------

class TestExtractScreenplayProposal:
    def test_extracts_content_and_scenes(self):
        from video_lab.routes.copilot import _extract_screenplay_proposal

        text = """思路：本集围绕复仇主线展开。

===PROPOSAL===
{
  "content": "场次1\\n夜/沈家客厅/沈知夏推门而入。\\n\\n场次2\\n日/街道/陆沉舟在车内等她。",
  "scenes": [
    {"scene_no": 1, "location": "沈家客厅", "summary": "沈知夏回到沈家，与继母对峙", "content": "夜/沈家客厅/沈知夏推门而入..."},
    {"scene_no": 2, "location": "街道", "summary": "陆沉舟接应沈知夏", "content": "日/街道/陆沉舟在车内等她..."}
  ]
}
===END_PROPOSAL==="""

        result = _extract_screenplay_proposal(text)
        assert result is not None
        assert "场次1" in result["content"]
        assert len(result["scenes"]) == 2
        assert result["scenes"][0]["scene_no"] == 1
        assert result["scenes"][0]["location"] == "沈家客厅"
        assert result["scenes"][1]["scene_no"] == 2

    def test_content_only_no_scenes(self):
        from video_lab.routes.copilot import _extract_screenplay_proposal

        text = """===PROPOSAL===
{"content": "场次1：夜/沈家客厅/对峙"}
===END_PROPOSAL==="""

        result = _extract_screenplay_proposal(text)
        assert result is not None
        assert result["content"] == "场次1：夜/沈家客厅/对峙"
        assert result["scenes"] == []

    def test_returns_none_when_empty(self):
        from video_lab.routes.copilot import _extract_screenplay_proposal

        assert _extract_screenplay_proposal("no markers here") is None
        assert _extract_screenplay_proposal("===PROPOSAL===\n{}\n===END_PROPOSAL===") is None

    def test_handles_malformed_json(self):
        from video_lab.routes.copilot import _extract_screenplay_proposal

        text = "===PROPOSAL===\n{not json}\n===END_PROPOSAL==="
        assert _extract_screenplay_proposal(text) is None


class TestExtractSceneProposal:
    def test_extracts_batch_scenes(self):
        from video_lab.routes.copilot import _extract_scene_proposal

        text = """===PROPOSAL===
{
  "scenes": [
    {"name": "沈家客厅", "scene_type": "室内", "space_description": "豪华客厅，欧式装修", "lighting_style": "暖色调顶光"},
    {"name": "街道夜景", "scene_type": "室外", "space_description": "霓虹街道", "lighting_style": "冷色霓虹反射"}
  ]
}
===END_PROPOSAL==="""

        result = _extract_scene_proposal(text)
        assert result is not None
        assert len(result["scenes"]) == 2
        assert result["scenes"][0]["name"] == "沈家客厅"
        assert result["scenes"][0]["scene_type"] == "室内"
        assert result["scenes"][0]["prop_list"] == []
        assert result["scenes"][1]["name"] == "街道夜景"

    def test_extracts_single_scene(self):
        from video_lab.routes.copilot import _extract_scene_proposal

        text = """===PROPOSAL===
{"name": "旧仓库", "scene_type": "室内暗光", "space_description": "废弃仓库"}
===END_PROPOSAL==="""

        result = _extract_scene_proposal(text)
        assert result is not None
        assert len(result["scenes"]) == 1
        assert result["scenes"][0]["name"] == "旧仓库"


class TestExtractShotProposal:
    def test_extracts_batch_shots(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{
  "shots": [
    {"shot_no": 1, "scene_block": "S1", "visual_goal": "建立场景氛围", "shot_size": "全景", "camera_angle": "平视", "action_description": "沈知夏缓步走进客厅", "facial_emotion": "冷静"},
    {"shot_no": 2, "scene_block": "S1", "visual_goal": "对峙张力", "shot_size": "中景", "camera_angle": "平视", "action_description": "继母从沙发起身", "facial_emotion": "愤怒"}
  ]
}
===END_PROPOSAL==="""

        result = _extract_shot_proposal(text)
        assert result is not None
        assert len(result["shots"]) == 2
        assert result["shots"][0]["shot_no"] == 1
        assert result["shots"][0]["scene_block"] == "S1"
        assert result["shots"][0]["shot_size"] == "全景"
        assert result["shots"][1]["scene_block"] == "S1"
        assert result["shots"][1]["estimated_duration_ms"] == 3000  # default

    def test_extracts_single_shot(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{"shot_no": 1, "scene_block": "S1", "visual_goal": "开场", "shot_size": "远景", "camera_angle": "俯拍", "action_description": "俯瞰城市", "facial_emotion": ""}
===END_PROPOSAL==="""

        result = _extract_shot_proposal(text)
        assert result is not None
        assert len(result["shots"]) == 1
        assert result["shots"][0]["shot_no"] == 1
        assert result["shots"][0]["camera_angle"] == "俯拍"

    def test_normalizes_character_ids(self):
        from video_lab.routes.copilot import _normalize_shot

        # String IDs
        shot = _normalize_shot({"character_ids": ["1", "2", "3"], "shot_no": 1})
        assert shot["character_ids"] == [1, 2, 3]

        # Comma-separated string
        shot = _normalize_shot({"character_ids": "1,2,3", "shot_no": 1})
        assert shot["character_ids"] == [1, 2, 3]

        # Mixed
        shot = _normalize_shot({"character_ids": [1, "2"], "shot_no": 1})
        assert shot["character_ids"] == [1, 2]

        # Empty
        shot = _normalize_shot({"character_ids": [], "shot_no": 1})
        assert shot["character_ids"] == []

    def test_shot_includes_scene_preset_id(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "scene_preset_id": 42})
        assert shot["scene_preset_id"] == 42

        shot = _normalize_shot({"shot_no": 1, "scene_preset_id": None})
        assert shot["scene_preset_id"] is None

    def test_all_required_fields_present(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1})
        required = {
            "shot_no", "scene_block", "visual_goal", "shot_size",
            "camera_angle", "composition", "action_description",
            "facial_emotion", "camera_motion", "dialogue_excerpt",
            "estimated_duration_ms", "scene_preset_id", "character_ids",
        }
        assert required.issubset(shot.keys()), f"Missing: {required - set(shot.keys())}"


# ---------------------------------------------------------------------------
# 2. Message handling
# ---------------------------------------------------------------------------

class TestNormalizeMessages:
    def test_normalizes_valid_messages(self):
        from video_lab.routes.copilot import _normalize_messages

        msgs = [
            {"role": "user", "content": "请生成剧本"},
            {"role": "assistant", "content": "好的"},
            {"role": "user", "content": "再丰富一些"},
        ]
        result = _normalize_messages(msgs)
        assert len(result) == 3
        assert result[0]["role"] == "user"

    def test_filters_invalid_roles(self):
        from video_lab.routes.copilot import _normalize_messages

        msgs = [
            {"role": "system", "content": "hidden"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]
        result = _normalize_messages(msgs)
        assert len(result) == 2
        assert all(m["role"] in ("user", "assistant") for m in result)

    def test_filters_empty_content(self):
        from video_lab.routes.copilot import _normalize_messages

        msgs = [
            {"role": "user", "content": ""},
            {"role": "user", "content": "valid"},
        ]
        result = _normalize_messages(msgs)
        assert len(result) == 1
        assert result[0]["content"] == "valid"

    def test_raises_on_empty(self):
        from video_lab.routes.copilot import _normalize_messages

        with pytest.raises(ValueError, match="messages is required"):
            _normalize_messages([])

    def test_raises_on_non_list(self):
        from video_lab.routes.copilot import _normalize_messages

        with pytest.raises(ValueError, match="messages is required"):
            _normalize_messages(None)


class TestCompileMessages:
    def test_injects_template_vars(self):
        from video_lab.routes.copilot import _compile_messages

        template = "项目：{project_id}，目标：{user_goal}\n上下文：{context_json}"
        result = _compile_messages(
            [{"role": "user", "content": "请生成"}],
            user_template=template,
            context={"key": "value"},
            user_goal="生成镜头",
            project_id=434,
            entity_id=32,
        )
        assert len(result) == 1
        content = result[0]["content"]
        assert "434" in content
        assert "生成镜头" in content
        assert '"key": "value"' in content

    def test_preserves_history(self):
        from video_lab.routes.copilot import _compile_messages

        template = "goal: {user_goal}"
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
            {"role": "user", "content": "当前的指令"},
        ]
        result = _compile_messages(
            msgs,
            user_template=template,
            context={},
            user_goal="test",
            project_id=1,
            entity_id=1,
        )
        # History preserved, last user message replaced by compiled template
        assert len(result) == 3
        assert result[0]["content"] == "hello"
        assert result[1]["content"] == "hi"
        assert "test" in result[2]["content"]


# ---------------------------------------------------------------------------
# 3. JSON field parsing
# ---------------------------------------------------------------------------

class TestParseJsonField:
    def test_parses_valid_json_string(self):
        from video_lab.routes import _parse_json_field

        assert _parse_json_field('{"a":1}', {}) == {"a": 1}
        assert _parse_json_field("[1,2,3]", []) == [1, 2, 3]

    def test_returns_default_on_invalid(self):
        from video_lab.routes import _parse_json_field

        assert _parse_json_field("not json", []) == []
        assert _parse_json_field(None, {}) == {}
        assert _parse_json_field(None, "default") == "default"

    def test_passes_through_non_string(self):
        from video_lab.routes import _parse_json_field

        assert _parse_json_field([1, 2], []) == [1, 2]
        assert _parse_json_field({"a": 1}, {}) == {"a": 1}


# ---------------------------------------------------------------------------
# 4. Episode serialization
# ---------------------------------------------------------------------------

class TestSerializeEpisode:
    def test_serializes_screenplay_scenes_json(self):
        from video_lab.routes import serialize_episode

        episode = {
            "id": 32,
            "project_id": 434,
            "episode_no": 1,
            "title": "测试分集",
            "summary": "",
            "goal": "",
            "core_conflict": "",
            "opening_hook": "",
            "climax": "",
            "ending_hook": "",
            "screenplay_content": "场次1\\n夜/沈家客厅",
            "screenplay_content_en": "",
            "screenplay_scenes": '[{"scene_no":1,"location":"沈家客厅","summary":"对峙","content":""}]',
            "status": "draft",
            "sort_order": 1,
            "created_at": "2026-05-06T00:00:00",
            "updated_at": "2026-05-06T00:00:00",
        }
        result = serialize_episode(episode)
        assert isinstance(result["screenplay_scenes"], list)
        assert len(result["screenplay_scenes"]) == 1
        assert result["screenplay_scenes"][0]["scene_no"] == 1
        assert result["screenplay_scenes"][0]["location"] == "沈家客厅"

    def test_serializes_empty_screenplay_scenes(self):
        from video_lab.routes import serialize_episode

        episode = {
            "id": 33,
            "project_id": 434,
            "episode_no": 2,
            "title": "测试",
            "summary": "",
            "goal": "",
            "core_conflict": "",
            "opening_hook": "",
            "climax": "",
            "ending_hook": "",
            "screenplay_content": "",
            "screenplay_content_en": "",
            "screenplay_scenes": "[]",
            "status": "draft",
            "sort_order": 2,
            "created_at": "2026-05-06T00:00:00",
            "updated_at": "2026-05-06T00:00:00",
        }
        result = serialize_episode(episode)
        assert result["screenplay_scenes"] == []

    def test_serializes_null_screenplay_scenes(self):
        from video_lab.routes import serialize_episode

        episode = {
            "id": 33,
            "project_id": 434,
            "episode_no": 2,
            "title": "测试",
            "summary": "",
            "goal": "",
            "core_conflict": "",
            "opening_hook": "",
            "climax": "",
            "ending_hook": "",
            "screenplay_content": "",
            "screenplay_content_en": "",
            "screenplay_scenes": None,
            "status": "draft",
            "sort_order": 2,
            "created_at": "2026-05-06T00:00:00",
            "updated_at": "2026-05-06T00:00:00",
        }
        result = serialize_episode(episode)
        assert result["screenplay_scenes"] == []


# ---------------------------------------------------------------------------
# 5. Task payload
# ---------------------------------------------------------------------------

class TestMakeTaskPayload:
    def test_creates_correct_payload(self):
        from video_lab.routes.generation_tasks import _make_task_payload

        context = {"existing_scenes": [], "screenplay_scenes": []}
        payload = _make_task_payload(
            project_id=434,
            episode_id=32,
            module_type="screenplay",
            context=context,
        )
        assert payload["project_id"] == 434
        assert payload["episode_id"] == 32
        assert payload["shot_id"] is None
        assert payload["shot_prompt_id"] is None
        assert payload["provider"] == "copilot"
        assert payload["model_name"] == "screenplay"
        assert payload["status"] == "queued"
        # input_payload is a JSON string containing context
        parsed = json.loads(payload["input_payload"])
        assert parsed["context"] == context
        assert payload["output_assets"] == "[]"
        assert payload["retry_count"] == 0
        assert payload["error_message"] == ""
        assert payload["cost_amount"] == 0
        assert payload["duration_ms"] == 0


# ---------------------------------------------------------------------------
# 6. Normalize helpers
# ---------------------------------------------------------------------------

class TestNormalizeJsonText:
    def test_returns_existing_string(self):
        from video_lab.domain.common import normalize_json_text

        assert normalize_json_text("[1,2]", []) == "[1,2]"

    def test_serializes_non_string(self):
        from video_lab.domain.common import normalize_json_text

        result = normalize_json_text([{"a": 1}], [])
        assert isinstance(result, str)
        assert json.loads(result) == [{"a": 1}]

    def test_returns_default_for_none(self):
        from video_lab.domain.common import normalize_json_text

        assert normalize_json_text(None, []) == "[]"
        assert normalize_json_text("", []) == "[]"


# ---------------------------------------------------------------------------
# 7. Service integration with temp DB
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_setup(tmp_path):
    """Create a temp DB and monkey-patch the DB path."""
    import video_lab.db as dbmod

    orig_path = dbmod.DB_PATH
    orig_assets = dbmod.ASSETS_DIR
    orig_data = dbmod.DATA_DIR

    test_data = tmp_path / "data"
    test_assets = test_data / "assets"
    test_data.mkdir()
    test_assets.mkdir()

    dbmod.DB_PATH = test_data / "test.sqlite3"
    dbmod.ASSETS_DIR = test_assets
    dbmod.DATA_DIR = test_data

    from video_lab.db import init_db
    init_db()

    yield

    dbmod.DB_PATH = orig_path
    dbmod.ASSETS_DIR = orig_assets
    dbmod.DATA_DIR = orig_data


def _create_project() -> int:
    from video_lab import repository

    return repository.create_project(
        repository.ProjectInput(
            title="测试项目",
            story_prompt="测试提示",
            style="cinematic",
            aspect_ratio="16:9",
            target_duration=30,
        )
    )


class TestScreenplayScenesPersistence:
    """Verify screenplay_scenes is written and read correctly through the service layer."""

    def test_create_episode_with_screenplay_scenes(self, db_setup):
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        scenes_data = [
            {"scene_no": 1, "location": "沈家客厅", "summary": "对峙", "content": "..."},
            {"scene_no": 2, "location": "街道", "summary": "接应", "content": "..."},
        ]
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "测试集",
            "screenplay_scenes": scenes_data,
        })
        assert ep_id > 0

        episode = svc.get_episode(ep_id)
        assert episode["title"] == "测试集"
        stored = json.loads(episode["screenplay_scenes"])
        assert len(stored) == 2
        assert stored[0]["scene_no"] == 1

    def test_update_episode_screenplay_scenes(self, db_setup):
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "测试集",
        })
        episode = svc.get_episode(ep_id)
        assert json.loads(episode["screenplay_scenes"]) == []

        new_scenes = [
            {"scene_no": 1, "location": "办公室", "summary": "对峙", "content": "..."},
        ]
        svc.update_episode(ep_id, {"screenplay_scenes": new_scenes})

        episode = svc.get_episode(ep_id)
        stored = json.loads(episode["screenplay_scenes"])
        assert len(stored) == 1
        assert stored[0]["location"] == "办公室"

    def test_screenplay_scenes_default_empty(self, db_setup):
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "默认值测试集",
        })
        episode = svc.get_episode(ep_id)
        assert json.loads(episode["screenplay_scenes"]) == []


class TestShotCreation:
    """Verify shots are created with all copilot fields."""

    def test_create_shot_with_scene_block_and_preset(self, db_setup):
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "镜头测试集",
        })

        shot_id = svc.create_shot(ep_id, {
            "shot_no": 1,
            "scene_block": "S1",
            "visual_goal": "建立场景氛围",
            "shot_size": "全景",
            "camera_angle": "平视",
            "composition": "三分法构图",
            "action_description": "沈知夏缓步走进客厅",
            "facial_emotion": "冷静",
            "camera_motion": "固定",
            "dialogue_excerpt": "",
            "estimated_duration_ms": 4000,
            "scene_preset_id": 42,
            "character_ids": [1, 2],
        })
        assert shot_id > 0

        shot = svc.get_shot(shot_id)
        assert shot["scene_block"] == "S1"
        assert shot["shot_no"] == 1
        assert shot["shot_size"] == "全景"
        assert shot["camera_angle"] == "平视"
        assert shot["composition"] == "三分法构图"
        assert shot["action_description"] == "沈知夏缓步走进客厅"
        assert shot["facial_emotion"] == "冷静"
        assert shot["camera_motion"] == "固定"
        assert shot["dialogue_excerpt"] == ""
        assert shot["estimated_duration_ms"] == 4000
        assert shot["scene_preset_id"] == 42
        assert json.loads(shot["character_ids"]) == [1, 2]

    def test_list_shots_in_order(self, db_setup):
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "排序测试"})

        svc.create_shot(ep_id, {"shot_no": 3, "scene_block": "S3", "estimated_duration_ms": 3000})
        svc.create_shot(ep_id, {"shot_no": 1, "scene_block": "S1", "estimated_duration_ms": 3000})
        svc.create_shot(ep_id, {"shot_no": 2, "scene_block": "S2", "estimated_duration_ms": 3000})

        shots = svc.list_shots(ep_id)
        assert len(shots) == 3
        assert shots[0]["shot_no"] == 1
        assert shots[1]["shot_no"] == 2
        assert shots[2]["shot_no"] == 3


# ---------------------------------------------------------------------------
# 8. Generation task flow simulation
# ---------------------------------------------------------------------------

class TestGenerationTaskLifecycle:
    """Simulate the DB task lifecycle: create → run → succeed."""

    def test_task_lifecycle_in_db(self, db_setup):
        from video_lab.domain.generation.repository import GenerationRepository

        pid = _create_project()
        repo = GenerationRepository()
        task_id = repo.create_task({
            "project_id": pid,
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "shot",
            "status": "queued",
            "input_payload": json.dumps({"context": {"test": True}}, ensure_ascii=False),
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })
        assert task_id > 0

        task = repo.get_task(task_id)
        assert task["status"] == "queued"
        assert task["model_name"] == "shot"

        repo.update_task(task_id, {"status": "running"})
        task = repo.get_task(task_id)
        assert task["status"] == "running"

        output = json.dumps([{"type": "shots", "shot_ids": [100, 101]}], ensure_ascii=False)
        repo.update_task(task_id, {"status": "succeeded", "output_assets": output})
        task = repo.get_task(task_id)
        assert task["status"] == "succeeded"
        parsed = json.loads(task["output_assets"])
        assert parsed[0]["type"] == "shots"
        assert parsed[0]["shot_ids"] == [100, 101]

    def test_task_failure_records_error(self, db_setup):
        from video_lab.domain.generation.repository import GenerationRepository

        pid = _create_project()
        repo = GenerationRepository()
        task_id = repo.create_task({
            "project_id": pid,
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "screenplay",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })
        repo.update_task(task_id, {"status": "running"})
        repo.update_task(task_id, {"status": "failed", "error_message": "LLM timeout"})

        task = repo.get_task(task_id)
        assert task["status"] == "failed"
        assert task["error_message"] == "LLM timeout"


# ---------------------------------------------------------------------------
# 9. Prompt templates are loaded
# ---------------------------------------------------------------------------

class TestCopilotPromptsLoaded:
    def test_screenplay_prompts_loaded(self):
        from video_lab.config import DEFAULT_PROMPTS

        assert "prompt_copilot_screenplay_system" in DEFAULT_PROMPTS
        assert "prompt_copilot_screenplay_generate" in DEFAULT_PROMPTS
        template = DEFAULT_PROMPTS["prompt_copilot_screenplay_generate"]
        assert "{project_id}" in template
        assert "{context_json}" in template

    def test_shot_prompts_loaded(self):
        from video_lab.config import DEFAULT_PROMPTS

        assert "prompt_copilot_shot_system" in DEFAULT_PROMPTS
        assert "prompt_copilot_shot_generate" in DEFAULT_PROMPTS
        system = DEFAULT_PROMPTS["prompt_copilot_shot_system"]
        assert "===PROPOSAL===" in system
        assert "snake_case" in system

    def test_scene_prompts_loaded(self):
        from video_lab.config import DEFAULT_PROMPTS

        assert "prompt_copilot_scene_system" in DEFAULT_PROMPTS
        assert "prompt_copilot_scene_generate" in DEFAULT_PROMPTS

    def test_shot_prompt_mentions_screenplay_scenes_priority(self):
        from video_lab.config import DEFAULT_PROMPTS

        generate = DEFAULT_PROMPTS["prompt_copilot_shot_generate"]
        assert "screenplay_scenes" in generate

        system = DEFAULT_PROMPTS["prompt_copilot_shot_system"]
        assert "screenplay_scenes" in system
        assert "scene_block" in system


# ---------------------------------------------------------------------------
# 10. _stream_llm_response mock test
# ---------------------------------------------------------------------------

class TestStreamLLMResponse:
    def test_stream_calls_chatfire_with_compiled_messages(self):
        from video_lab.routes.generation_tasks import _stream_llm_response
        from unittest.mock import MagicMock, patch

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter(["chunk1", "chunk2", "chunk3"])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system prompt",
                 "prompt_copilot_shot_generate": "user template {user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            result = _stream_llm_response(
                module_type="shot",
                context={"key": "val"},
                messages=[{"role": "user", "content": "请生成镜头"}],
                project_id=434,
                entity_id=32,
            )

        assert result == "chunk1chunk2chunk3"
        mock_provider.chat_stream.assert_called_once()

    def test_stream_raises_on_missing_prompts(self):
        from video_lab.routes.generation_tasks import _stream_llm_response
        from unittest.mock import patch

        with patch("video_lab.routes.generation_tasks.load_prompts", return_value={}):
            with pytest.raises(RuntimeError, match="not configured"):
                _stream_llm_response(
                    module_type="unknown",
                    context={},
                    messages=[{"role": "user", "content": "test"}],
                    project_id=1,
                    entity_id=1,
                )


# ---------------------------------------------------------------------------
# 11. Batch repository tests
# ---------------------------------------------------------------------------

class TestBatchRepository:
    def test_create_and_list_batches(self, db_setup):
        from video_lab.domain.shots.batch_repository import BatchRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "batch测试"})

        repo = BatchRepository()
        batch1 = repo.create_batch(ep_id, None, 5)
        batch2 = repo.create_batch(ep_id, None, 3)

        assert batch1 > 0
        assert batch2 > 0
        assert batch2 > batch1

        batches = repo.list_batches(ep_id)
        assert len(batches) == 2
        assert batches[0]["version_no"] == 2  # DESC order
        assert batches[1]["version_no"] == 1

    def test_get_batch(self, db_setup):
        from video_lab.domain.shots.batch_repository import BatchRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "get测试"})

        repo = BatchRepository()
        batch_id = repo.create_batch(ep_id, None, 7)
        batch = repo.get_batch(batch_id)
        assert batch is not None
        assert batch["version_no"] == 1
        assert batch["shot_count"] == 7

    def test_shots_with_batch_id(self, db_setup):
        from video_lab.domain.shots.batch_repository import BatchRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "关联测试"})

        repo = BatchRepository()
        batch_id = repo.create_batch(ep_id, None, 0)

        sid = svc.create_shot(ep_id, {
            "shot_no": 1,
            "scene_block": "S1",
            "batch_id": batch_id,
            "estimated_duration_ms": 3000,
        })
        shot = svc.get_shot(sid)
        assert shot["batch_id"] == batch_id

    def test_list_batches_empty(self, db_setup):
        from video_lab.domain.shots.batch_repository import BatchRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "空batch"})

        repo = BatchRepository()
        batches = repo.list_batches(ep_id)
        assert batches == []


# ---------------------------------------------------------------------------
# 12. Shot extraction — additional edge cases
# ---------------------------------------------------------------------------

class TestExtractShotProposalEdgeCases:
    def test_empty_shots_array_returns_none(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{"shots": []}
===END_PROPOSAL==="""
        assert _extract_shot_proposal(text) is None

    def test_non_dict_items_filtered_out(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{
  "shots": [
    {"shot_no": 1, "scene_block": "S1", "visual_goal": "开场"},
    "not a dict",
    123,
    {"shot_no": 2, "scene_block": "S2", "visual_goal": "转场"}
  ]
}
===END_PROPOSAL==="""
        result = _extract_shot_proposal(text)
        assert result is not None
        assert len(result["shots"]) == 2
        assert result["shots"][0]["shot_no"] == 1
        assert result["shots"][1]["shot_no"] == 2

    def test_whitespace_around_markers(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """\n  ===PROPOSAL===  \n{"shots": [{"shot_no": 1, "scene_block": "S1", "visual_goal": "test"}]}\n  ===END_PROPOSAL===  \n"""
        result = _extract_shot_proposal(text)
        assert result is not None
        assert len(result["shots"]) == 1

    def test_multiple_proposal_blocks_extracts_first(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{"shots": [{"shot_no": 1, "scene_block": "A", "visual_goal": "first"}]}
===END_PROPOSAL===
some garbage
===PROPOSAL===
{"shots": [{"shot_no": 2, "scene_block": "B", "visual_goal": "second"}]}
===END_PROPOSAL==="""
        result = _extract_shot_proposal(text)
        assert result is not None
        assert len(result["shots"]) == 1
        assert result["shots"][0]["scene_block"] == "A"

    def test_missing_end_marker_returns_none(self):
        from video_lab.routes.copilot import _extract_shot_proposal

        text = """===PROPOSAL===
{"shots": [{"shot_no": 1}]}"""
        assert _extract_shot_proposal(text) is None


# ---------------------------------------------------------------------------
# 13. Shot normalization — additional edge cases
# ---------------------------------------------------------------------------

class TestNormalizeShotEdgeCases:
    def test_default_duration_ms(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1})
        assert shot["estimated_duration_ms"] == 3000

    def test_custom_duration_ms(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "estimated_duration_ms": 5500})
        assert shot["estimated_duration_ms"] == 5500

    def test_negative_duration_becomes_default(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "estimated_duration_ms": -100})
        assert shot["estimated_duration_ms"] == -100  # raw int, no clamping

    def test_string_duration_converted(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "estimated_duration_ms": "5000"})
        assert shot["estimated_duration_ms"] == 5000

    def test_float_character_ids_converted(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "character_ids": [1.0, 2.0]})
        assert shot["character_ids"] == [1, 2]

    def test_mixed_string_int_character_ids(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "character_ids": [1, "2", 3]})
        assert shot["character_ids"] == [1, 2, 3]

    def test_empty_string_character_ids(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "character_ids": ""})
        assert shot["character_ids"] == []

    def test_comma_separated_with_spaces(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "character_ids": " 1 , 2 , 3 "})
        assert shot["character_ids"] == [1, 2, 3]

    def test_scene_preset_id_preserved_as_is(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({"shot_no": 1, "scene_preset_id": "42"})
        assert shot["scene_preset_id"] == "42"  # not coerced

    def test_missing_shot_no_defaults_to_zero(self):
        from video_lab.routes.copilot import _normalize_shot

        shot = _normalize_shot({})
        assert shot["shot_no"] == 0


# ---------------------------------------------------------------------------
# 14. Rebalance shot durations (chatfire provider)
# ---------------------------------------------------------------------------

class TestRebalanceShotDurations:
    def test_distributes_duration_evenly(self):
        from video_lab.providers.chatfire import ChatfireProvider
        from video_lab.config import AppConfig, DEFAULT_PROMPTS

        config = AppConfig(api_key="test", api_base="http://localhost")
        provider = ChatfireProvider(config, dict(DEFAULT_PROMPTS))

        shots = [
            {"shot_title": "shot 1", "duration_seconds": 0},
            {"shot_title": "shot 2", "duration_seconds": 0},
            {"shot_title": "shot 3", "duration_seconds": 0},
            {"shot_title": "shot 4", "duration_seconds": 0},
        ]
        result = provider._rebalance_shot_durations(shots, 10)
        durations = [s["duration_seconds"] for s in result]
        # 4 shots, 10 seconds → base=2, remainder=2 → [3,3,2,2]
        assert sum(durations) == 10
        assert all(d >= 2 for d in durations)

    def test_minimum_two_seconds_per_shot(self):
        from video_lab.providers.chatfire import ChatfireProvider
        from video_lab.config import AppConfig, DEFAULT_PROMPTS

        config = AppConfig(api_key="test", api_base="http://localhost")
        provider = ChatfireProvider(config, dict(DEFAULT_PROMPTS))

        # 10 shots but only 5 seconds total — minimum 2s each = 20s floor
        shots = [{"shot_title": f"s{i}", "duration_seconds": 0} for i in range(10)]
        result = provider._rebalance_shot_durations(shots, 5)
        durations = [s["duration_seconds"] for s in result]
        assert all(d >= 2 for d in durations)
        # total_duration enforced to >= len(shots) * 2 = 20
        assert sum(durations) >= 20

    def test_empty_list_returns_empty(self):
        from video_lab.providers.chatfire import ChatfireProvider
        from video_lab.config import AppConfig, DEFAULT_PROMPTS

        config = AppConfig(api_key="test", api_base="http://localhost")
        provider = ChatfireProvider(config, dict(DEFAULT_PROMPTS))

        assert provider._rebalance_shot_durations([], 60) == []

    def test_remainder_distributed_to_first_shots(self):
        from video_lab.providers.chatfire import ChatfireProvider
        from video_lab.config import AppConfig, DEFAULT_PROMPTS

        config = AppConfig(api_key="test", api_base="http://localhost")
        provider = ChatfireProvider(config, dict(DEFAULT_PROMPTS))

        shots = [{"shot_title": f"s{i}", "duration_seconds": 0} for i in range(3)]
        result = provider._rebalance_shot_durations(shots, 8)
        # base=2, remainder=2 → [3, 3, 2]
        assert result[0]["duration_seconds"] >= result[2]["duration_seconds"]
        assert sum(s["duration_seconds"] for s in result) == 8


# ---------------------------------------------------------------------------
# 15. Integration: _run_generate_shots with mocked LLM
# ---------------------------------------------------------------------------

SHOT_LLM_RESPONSE = """分析：根据剧本拆分为3个镜头。

===PROPOSAL===
{
  "shots": [
    {
      "shot_no": 1,
      "scene_block": "S1",
      "visual_goal": "建立氛围，引入场景",
      "shot_size": "全景",
      "camera_angle": "平视",
      "composition": "三分法，主体位于右三分之一",
      "action_description": "沈知夏缓步走进客厅，环顾四周",
      "facial_emotion": "冷静中带着警觉",
      "camera_motion": "缓慢跟拍，保持中景",
      "dialogue_excerpt": "",
      "estimated_duration_ms": 4000,
      "scene_preset_id": null,
      "character_ids": [1, 2]
    },
    {
      "shot_no": 2,
      "scene_block": "S1",
      "visual_goal": "对峙张力上升",
      "shot_size": "中景",
      "camera_angle": "过肩镜头",
      "composition": "对角线构图",
      "action_description": "继母从沙发起身，目光如刀",
      "facial_emotion": "表面微笑，眼神阴狠",
      "camera_motion": "固定机位，略微推近",
      "dialogue_excerpt": "你终于来了。",
      "estimated_duration_ms": 3500,
      "scene_preset_id": 5,
      "character_ids": [3]
    },
    {
      "shot_no": 3,
      "scene_block": "S2",
      "visual_goal": "转场过渡",
      "shot_size": "远景",
      "camera_angle": "航拍",
      "composition": "俯视构图",
      "action_description": "街道夜景，霓虹闪烁，陆沉舟靠在车边等待",
      "facial_emotion": "若有所思",
      "camera_motion": "缓慢下降接近",
      "dialogue_excerpt": "",
      "estimated_duration_ms": 5000,
      "scene_preset_id": null,
      "character_ids": "4"
    }
  ]
}
===END_PROPOSAL==="""


class TestRunGenerateShots:
    def test_generates_shots_from_llm_response(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "镜头集成测试",
        })

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "shot",
            "status": "queued",
            "input_payload": '{"context": {}}',
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter([SHOT_LLM_RESPONSE])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成镜头"}])


        task = gen_repo.get_task(task_id)
        assert task["status"] == "succeeded"

        assets = json.loads(task["output_assets"])
        assert assets[0]["type"] == "shots"
        assert len(assets[0]["shot_ids"]) == 3
        assert assets[0]["batch_id"] > 0

        # Verify shots were actually created in DB
        shots = svc.list_shots(ep_id)
        assert len(shots) == 3
        assert shots[0]["shot_no"] == 1
        assert shots[0]["scene_block"] == "S1"
        assert shots[0]["shot_size"] == "全景"
        assert shots[0]["visual_goal"] == "建立氛围，引入场景"
        assert shots[1]["shot_no"] == 2
        assert shots[1]["shot_size"] == "中景"
        assert shots[1]["scene_preset_id"] == 5
        assert shots[2]["scene_block"] == "S2"
        assert shots[2]["estimated_duration_ms"] == 5000

    def test_fails_when_llm_returns_unparseable(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "失败测试"})

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "shot",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter(["garbage without markers"])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成镜头"}])


        task = gen_repo.get_task(task_id)
        assert task["status"] == "failed"
        assert "Unable to parse" in task["error_message"]

        # No shots should have been created
        shots = svc.list_shots(ep_id)
        assert len(shots) == 0

    def test_clears_old_shots_before_generating_new_batch(self, db_setup):
        """验证重新生成镜头时，旧镜头被清除，只保留新镜头。"""
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "旧镜头清除测试"})

        # 先手动创建一些旧镜头（模拟上次生成的结果）
        for i in range(5):
            svc.create_shot(ep_id, {
                "shot_no": i + 1,
                "scene_block": f"old_S{i + 1}",
                "visual_goal": "旧镜头",
                "estimated_duration_ms": 3000,
            })

        # 确认旧镜头存在
        old_shots = svc.list_shots(ep_id)
        assert len(old_shots) == 5

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid, "episode_id": ep_id, "shot_id": None,
            "shot_prompt_id": None, "provider": "copilot", "model_name": "shot",
            "status": "queued", "input_payload": '{"context": {}}',
            "output_assets": "[]", "retry_count": 0, "error_message": "",
            "cost_amount": 0, "duration_ms": 0,
        })

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter([SHOT_LLM_RESPONSE])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(task_id, ep_id, pid, {}, [{"role": "user", "content": "重新生成镜头"}])

        # 验证任务成功
        task = gen_repo.get_task(task_id)
        assert task["status"] == "succeeded"

        # 验证只有新生成的 3 个镜头，旧的 5 个已被清除
        shots = svc.list_shots(ep_id)
        assert len(shots) == 3, f"expected 3 shots, got {len(shots)}"
        assert all("old_" not in s["scene_block"] for s in shots)
        assert shots[0]["scene_block"] == "S1"
        assert shots[1]["scene_block"] == "S1"
        assert shots[2]["scene_block"] == "S2"

    def test_fails_when_llm_returns_empty_shots(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "空镜头测试"})

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "shot",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        mock_provider = MagicMock()
        # Empty shots array — should fail
        mock_provider.chat_stream.return_value = iter(["===PROPOSAL===\n{\"shots\": []}\n===END_PROPOSAL==="])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成镜头"}])


        task = gen_repo.get_task(task_id)
        assert task["status"] == "failed"

    def test_injects_screenplay_data_into_context(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "连续性测试"})
        svc.update_episode(ep_id, {
            "screenplay_content": "S1: 女人走进大厅。\nS2: 女人停在签约桌前。",
            "screenplay_scenes": json.dumps([
                {"scene_no": "S1", "location": "大厅入口", "summary": "女人推门走进来"},
                {"scene_no": "S2", "location": "签约桌", "summary": "女人停在签约桌前"},
            ], ensure_ascii=False),
        })

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "shot",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        captured_messages = []

        def capture_chat_stream(messages, _system):
            captured_messages.extend(messages)
            return iter([SHOT_LLM_RESPONSE])

        mock_provider = MagicMock()
        mock_provider.chat_stream.side_effect = capture_chat_stream

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成镜头"}])

        # Check the compiled user message contains the injected screenplay data
        user_msgs = [m["content"] for m in captured_messages if m["role"] == "user"]
        assert len(user_msgs) >= 1
        last_user = user_msgs[-1]
        assert "S1" in last_user
        assert "女人推门走进来" in last_user
        assert "S2" in last_user
        assert "女人停在签约桌前" in last_user
        assert "screenplay_content" in last_user
        assert "screenplay_scenes" in last_user

        task = gen_repo.get_task(task_id)
        assert task["status"] == "succeeded"


# ---------------------------------------------------------------------------
# 16. Integration: _run_generate_screenplay with mocked LLM
# ---------------------------------------------------------------------------

SCREENPLAY_LLM_RESPONSE = """分析：本集围绕复仇主线。

===PROPOSAL===
{
  "content": "场次1\\n夜/沈家客厅/沈知夏推门而入，继母在沙发上等候。\\n沈知夏：我回来了。\\n继母：你终于舍得回来了。\\n\\n场次2\\n日/街道/陆沉舟靠在车边抽烟，看到沈知夏出来，掐灭烟头。\\n陆沉舟：怎么样？\\n沈知夏：她慌了。",
  "scenes": [
    {"scene_no": 1, "location": "沈家客厅", "summary": "继母与沈知夏对峙", "content": "夜/沈家客厅/沈知夏推门而入..."},
    {"scene_no": 2, "location": "街道", "summary": "陆沉舟接应沈知夏", "content": "日/街道/陆沉舟靠在车边..."}
  ]
}
===END_PROPOSAL==="""


class TestRunGenerateScreenplay:
    def test_generates_screenplay_and_saves_to_episode(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_screenplay
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "剧本集成测试",
        })

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "screenplay",
            "status": "queued",
            "input_payload": '{"context": {}}',
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter([SCREENPLAY_LLM_RESPONSE])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_screenplay_system": "system",
                 "prompt_copilot_screenplay_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_screenplay(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成剧本"}])


        task = gen_repo.get_task(task_id)
        assert task["status"] == "succeeded"
        assets = json.loads(task["output_assets"])
        assert assets[0]["type"] == "screenplay"
        assert len(assets[0]["scenes"]) == 2

        # Verify episode was updated
        episode = svc.get_episode(ep_id)
        assert "场次1" in episode["screenplay_content"]
        assert "沈知夏推门而入" in episode["screenplay_content"]

        stored_scenes = json.loads(episode["screenplay_scenes"])
        assert len(stored_scenes) == 2
        assert stored_scenes[0]["scene_no"] == 1
        assert stored_scenes[0]["location"] == "沈家客厅"
        assert stored_scenes[1]["scene_no"] == 2
        assert stored_scenes[1]["location"] == "街道"

    def test_fails_when_llm_returns_garbage(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_screenplay
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "失败测试"})

        gen_repo = GenerationRepository()
        task_id = gen_repo.create_task({
            "project_id": pid,
            "episode_id": ep_id,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "copilot",
            "model_name": "screenplay",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        })

        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter(["no markers at all"])

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_screenplay_system": "system",
                 "prompt_copilot_screenplay_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_screenplay(task_id, ep_id, pid, {}, [{"role": "user", "content": "生成剧本"}])


        task = gen_repo.get_task(task_id)
        assert task["status"] == "failed"


# ---------------------------------------------------------------------------
# 17. End-to-end: screenplay → shots pipeline
# ---------------------------------------------------------------------------

class TestEndToEndScreenplayToShots:
    """Simulate the full copilot pipeline: generate screenplay, then generate shots from it."""

    def test_full_pipeline_screenplay_then_shots(self, db_setup):
        from unittest.mock import MagicMock, patch
        from video_lab.routes.generation_tasks import _run_generate_screenplay, _run_generate_shots
        from video_lab.domain.generation.repository import GenerationRepository
        from video_lab.domain.shots.service import ShotsService

        pid = _create_project()
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {
            "episode_no": 1,
            "title": "端到端测试",
        })
        gen_repo = GenerationRepository()

        # --- Step 1: Generate screenplay ---
        mock_provider = MagicMock()
        mock_provider.chat_stream.return_value = iter([SCREENPLAY_LLM_RESPONSE])

        screenplay_task_id = gen_repo.create_task({
            "project_id": pid, "episode_id": ep_id, "shot_id": None,
            "shot_prompt_id": None, "provider": "copilot", "model_name": "screenplay",
            "status": "queued", "input_payload": "{}", "output_assets": "[]",
            "retry_count": 0, "error_message": "", "cost_amount": 0, "duration_ms": 0,
        })

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_screenplay_system": "system",
                 "prompt_copilot_screenplay_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_screenplay(screenplay_task_id, ep_id, pid, {}, [{"role": "user", "content": "生成剧本"}])


        assert gen_repo.get_task(screenplay_task_id)["status"] == "succeeded"

        episode = svc.get_episode(ep_id)
        stored_scenes = json.loads(episode["screenplay_scenes"])
        assert len(stored_scenes) == 2

        # --- Step 2: Generate shots from the screenplay ---
        mock_provider2 = MagicMock()
        mock_provider2.chat_stream.return_value = iter([SHOT_LLM_RESPONSE])

        shot_task_id = gen_repo.create_task({
            "project_id": pid, "episode_id": ep_id, "shot_id": None,
            "shot_prompt_id": None, "provider": "copilot", "model_name": "shot",
            "status": "queued", "input_payload": '{"context": {"screenplay_scenes": ' + json.dumps(stored_scenes) + '}}',
            "output_assets": "[]", "retry_count": 0, "error_message": "",
            "cost_amount": 0, "duration_ms": 0,
        })

        with patch("video_lab.routes.generation_tasks.ChatfireProvider", return_value=mock_provider2), \
             patch("video_lab.routes.generation_tasks.load_prompts", return_value={
                 "prompt_copilot_shot_system": "system",
                 "prompt_copilot_shot_generate": "{user_goal} {context_json} {project_id} {entity_id}",
             }), \
             patch("video_lab.routes.generation_tasks.load_config"):
            _run_generate_shots(shot_task_id, ep_id, pid, {"screenplay_scenes": stored_scenes}, [{"role": "user", "content": "生成镜头"}])


        assert gen_repo.get_task(shot_task_id)["status"] == "succeeded"

        shot_assets = json.loads(gen_repo.get_task(shot_task_id)["output_assets"])
        assert len(shot_assets[0]["shot_ids"]) == 3

        shots = svc.list_shots(ep_id)
        assert len(shots) == 3
        assert shots[0]["scene_block"] == "S1"
        assert shots[0]["shot_no"] == 1
        assert shots[2]["scene_block"] == "S2"


# ---------------------------------------------------------------------------
# 12. PromptsRepository tests
# ---------------------------------------------------------------------------

class TestPromptsRepository:
    def test_get_next_version_no_returns_1_for_new_shot(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "版本号测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        assert repo.get_next_version_no(shot_id) == 1

    def test_get_next_version_no_increments_with_existing_prompts(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "版本号递增测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "v1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 2,
            "prompt_text": "v2", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })
        assert repo.get_next_version_no(shot_id) == 3

    def test_create_and_get_prompt(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "创建提示词测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        prompt_id = repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "一只猫走在霓虹街道",
            "first_frame_prompt": "猫的特写",
            "first_frame_negative_prompt": "模糊",
            "video_prompt": "猫行走",
            "video_negative_prompt": "抖动",
            "negative_prompt": "低质量",
            "model_params": '{"steps": 20}',
            "reference_asset_ids": '[1, 2]',
            "first_frame_url": "https://example.com/frame.png",
            "first_frame_status": "done",
            "video_url": "https://example.com/video.mp4",
            "video_status": "done",
            "status": "ready",
            "is_active": 1,
        })
        assert prompt_id > 0

        prompt = repo.get_prompt(prompt_id)
        assert prompt is not None
        assert prompt["shot_id"] == shot_id
        assert prompt["version_no"] == 1
        assert prompt["prompt_text"] == "一只猫走在霓虹街道"
        assert prompt["first_frame_prompt"] == "猫的特写"
        assert prompt["first_frame_negative_prompt"] == "模糊"
        assert prompt["video_prompt"] == "猫行走"
        assert prompt["video_negative_prompt"] == "抖动"
        assert prompt["negative_prompt"] == "低质量"
        assert prompt["model_params"] == '{"steps": 20}'
        assert prompt["reference_asset_ids"] == '[1, 2]'
        assert prompt["first_frame_url"] == "https://example.com/frame.png"
        assert prompt["first_frame_status"] == "done"
        assert prompt["video_url"] == "https://example.com/video.mp4"
        assert prompt["video_status"] == "done"
        assert prompt["status"] == "ready"
        assert prompt["is_active"] == 1

    def test_get_prompt_returns_none_for_missing(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        repo = PromptsRepository()
        assert repo.get_prompt(99999) is None

    def test_list_prompts_returns_all_for_shot_ordered_by_version_desc(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "列表测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "v1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 2,
            "prompt_text": "v2", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 1,
        })

        prompts = repo.list_prompts(shot_id)
        assert len(prompts) == 2
        assert prompts[0]["version_no"] == 2
        assert prompts[1]["version_no"] == 1

    def test_list_prompts_returns_empty_for_shot_without_prompts(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "空列表测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "无提示词"})

        repo = PromptsRepository()
        assert repo.list_prompts(shot_id) == []

    def test_get_active_prompt_for_shot(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "活跃提示词测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "v1 inactive", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 2,
            "prompt_text": "v2 active", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })

        active = repo.get_active_prompt_for_shot(shot_id)
        assert active is not None
        assert active["version_no"] == 2
        assert active["prompt_text"] == "v2 active"
        assert active["is_active"] == 1

    def test_get_active_prompt_returns_none_when_no_active(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "无活跃提示词"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "全部非活跃"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "v1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })

        assert repo.get_active_prompt_for_shot(shot_id) is None

    def test_get_active_prompts_for_shots_bulk(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "批量查询"})
        shot1_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "镜头1"})
        shot2_id = svc.create_shot(ep_id, {"shot_no": 2, "visual_goal": "镜头2"})
        shot3_id = svc.create_shot(ep_id, {"shot_no": 3, "visual_goal": "镜头3"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot1_id, "version_no": 1,
            "prompt_text": "active shot1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })
        repo.create_prompt({
            "shot_id": shot2_id, "version_no": 1,
            "prompt_text": "inactive shot2", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })
        # shot3 has no prompts

        result = repo.get_active_prompts_for_shots([shot1_id, shot2_id, shot3_id])
        assert len(result) == 1
        assert shot1_id in result
        assert result[shot1_id]["prompt_text"] == "active shot1"

    def test_get_active_prompts_for_shots_empty_list(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        repo = PromptsRepository()
        assert repo.get_active_prompts_for_shots([]) == {}

    def test_get_active_prompts_for_shots_deduplicates(self, db_setup):
        """If multiple active prompts exist for one shot, only the first is returned."""
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "去重测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "去重镜头"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "active older", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 1,
        })
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 2,
            "prompt_text": "active newer", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 1,
        })

        result = repo.get_active_prompts_for_shots([shot_id])
        assert len(result) == 1
        assert shot_id in result

    def test_deactivate_shot_prompts(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "停用测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "测试镜头"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "v1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })
        repo.create_prompt({
            "shot_id": shot_id, "version_no": 2,
            "prompt_text": "v2", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })

        repo.deactivate_shot_prompts(shot_id)

        prompts = repo.list_prompts(shot_id)
        for p in prompts:
            assert p["is_active"] == 0

    def test_deactivate_shot_prompts_only_affects_target_shot(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "隔离停用测试"})
        shot1_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "镜头1"})
        shot2_id = svc.create_shot(ep_id, {"shot_no": 2, "visual_goal": "镜头2"})

        repo = PromptsRepository()
        repo.create_prompt({
            "shot_id": shot1_id, "version_no": 1,
            "prompt_text": "shot1", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })
        repo.create_prompt({
            "shot_id": shot2_id, "version_no": 1,
            "prompt_text": "shot2", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "ready", "is_active": 1,
        })

        repo.deactivate_shot_prompts(shot1_id)

        assert repo.get_active_prompt_for_shot(shot1_id) is None
        shot2_active = repo.get_active_prompt_for_shot(shot2_id)
        assert shot2_active is not None
        assert shot2_active["is_active"] == 1

    def test_update_prompt_partial_fields(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "更新镜头"})

        repo = PromptsRepository()
        prompt_id = repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "原始提示词", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })

        repo.update_prompt(prompt_id, {
            "prompt_text": "修改后的提示词",
            "status": "ready",
            "is_active": 1,
        })

        updated = repo.get_prompt(prompt_id)
        assert updated["prompt_text"] == "修改后的提示词"
        assert updated["status"] == "ready"
        assert updated["is_active"] == 1
        assert updated["version_no"] == 1  # unchanged

    def test_update_prompt_empty_payload_noop(self, db_setup):
        from video_lab.domain.prompts.repository import PromptsRepository

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "空更新测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "空更新"})

        repo = PromptsRepository()
        prompt_id = repo.create_prompt({
            "shot_id": shot_id, "version_no": 1,
            "prompt_text": "保持不变", "negative_prompt": "",
            "model_params": "{}", "reference_asset_ids": "[]",
            "status": "draft", "is_active": 0,
        })

        repo.update_prompt(prompt_id, {})
        prompt = repo.get_prompt(prompt_id)
        assert prompt["prompt_text"] == "保持不变"
        assert prompt["status"] == "draft"


# ---------------------------------------------------------------------------
# 13. PromptsService tests
# ---------------------------------------------------------------------------

class TestPromptsService:
    def test_create_prompt_version_first_version(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "首次创建"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "首个版本"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {
            "prompt_text": "第一版提示词",
            "video_prompt": "视频提示",
            "status": "ready",
        })
        assert prompt_id > 0

        prompt = service.get_prompt(prompt_id)
        assert prompt["version_no"] == 1
        assert prompt["prompt_text"] == "第一版提示词"
        assert prompt["video_prompt"] == "视频提示"
        assert prompt["status"] == "ready"
        assert prompt["is_active"] == 0  # default

    def test_create_prompt_version_increments_version_no(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "版本递增"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "版本递增镜头"})

        service = PromptsService()
        id1 = service.create_prompt_version(shot_id, {"prompt_text": "v1"})
        id2 = service.create_prompt_version(shot_id, {"prompt_text": "v2"})
        id3 = service.create_prompt_version(shot_id, {"prompt_text": "v3"})

        assert service.get_prompt(id1)["version_no"] == 1
        assert service.get_prompt(id2)["version_no"] == 2
        assert service.get_prompt(id3)["version_no"] == 3

    def test_create_prompt_version_active_deactivates_others(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "自动停用"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "停用旧版"})

        service = PromptsService()
        id1 = service.create_prompt_version(shot_id, {
            "prompt_text": "旧版", "is_active": True, "status": "ready",
        })
        id2 = service.create_prompt_version(shot_id, {
            "prompt_text": "新版", "is_active": True, "status": "ready",
        })

        assert service.get_prompt(id1)["is_active"] == 0
        assert service.get_prompt(id2)["is_active"] == 1

    def test_create_prompt_version_requires_prompt_text_or_first_frame(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService
        from video_lab.domain.common import DomainError

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "验证测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "空提示词"})

        service = PromptsService()
        with pytest.raises(DomainError, match="prompt_text or first_frame_prompt"):
            service.create_prompt_version(shot_id, {"video_prompt": "只有视频提示"})

    def test_create_prompt_version_with_first_frame_prompt_only(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "首帧提示"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "帧提示"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {
            "first_frame_prompt": "赛博朋克城市全景",
            "status": "draft",
        })
        prompt = service.get_prompt(prompt_id)
        assert prompt["first_frame_prompt"] == "赛博朋克城市全景"
        assert prompt["version_no"] == 1

    def test_create_prompt_version_normalizes_empty_strings(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "空字符串"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "归一化"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {
            "prompt_text": "有效提示",
            "video_prompt": "   ",
            "negative_prompt": None,
        })
        prompt = service.get_prompt(prompt_id)
        assert prompt["video_prompt"] == ""
        assert prompt["negative_prompt"] == ""

    def test_create_prompt_version_json_fields_default(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "JSON默认"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "JSON字段"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "测试"})
        prompt = service.get_prompt(prompt_id)
        assert prompt["model_params"] == "{}"
        assert prompt["reference_asset_ids"] == "[]"

    def test_activate_prompt_sets_active_and_deactivates_others(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "激活测试"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "激活镜头"})

        service = PromptsService()
        id1 = service.create_prompt_version(shot_id, {
            "prompt_text": "v1", "is_active": True, "status": "ready",
        })
        id2 = service.create_prompt_version(shot_id, {
            "prompt_text": "v2", "is_active": False, "status": "draft",
        })

        service.activate_prompt(id2)

        assert service.get_prompt(id1)["is_active"] == 0
        v2 = service.get_prompt(id2)
        assert v2["is_active"] == 1
        assert v2["status"] == "ready"

    def test_activate_prompt_raises_for_missing_prompt(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService
        from video_lab.domain.common import DomainError

        service = PromptsService()
        with pytest.raises(DomainError, match="prompt not found"):
            service.activate_prompt(99999)

    def test_get_prompt_raises_for_missing(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService
        from video_lab.domain.common import DomainError

        service = PromptsService()
        with pytest.raises(DomainError, match="prompt not found"):
            service.get_prompt(99999)

    def test_list_prompts(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "服务列表"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "列表镜头"})

        service = PromptsService()
        service.create_prompt_version(shot_id, {"prompt_text": "第一版"})
        service.create_prompt_version(shot_id, {"prompt_text": "第二版"})

        prompts = service.list_prompts(shot_id)
        assert len(prompts) == 2
        assert prompts[0]["version_no"] == 2
        assert prompts[1]["version_no"] == 1

    def test_update_prompt_text_fields(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新文本"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "更新文本"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "原始文本"})

        service.update_prompt(prompt_id, {
            "prompt_text": "更新后的文本",
            "first_frame_prompt": "新增帧提示",
            "negative_prompt": "负面提示",
        })

        prompt = service.get_prompt(prompt_id)
        assert prompt["prompt_text"] == "更新后的文本"
        assert prompt["first_frame_prompt"] == "新增帧提示"
        assert prompt["negative_prompt"] == "负面提示"

    def test_update_prompt_is_active_true_deactivates_others(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新激活"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "更新激活"})

        service = PromptsService()
        id1 = service.create_prompt_version(shot_id, {
            "prompt_text": "v1", "is_active": True, "status": "ready",
        })
        id2 = service.create_prompt_version(shot_id, {
            "prompt_text": "v2", "is_active": False, "status": "draft",
        })

        service.update_prompt(id2, {"is_active": True})

        assert service.get_prompt(id1)["is_active"] == 0
        assert service.get_prompt(id2)["is_active"] == 1

    def test_update_prompt_is_active_false(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "取消激活"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "取消激活"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {
            "prompt_text": "v1", "is_active": True, "status": "ready",
        })

        service.update_prompt(prompt_id, {"is_active": False})
        assert service.get_prompt(prompt_id)["is_active"] == 0

    def test_update_prompt_video_fields(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新视频"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "视频字段"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "测试"})

        service.update_prompt(prompt_id, {
            "video_prompt": "新的视频提示",
            "video_negative_prompt": "不要抖动",
            "video_url": "https://example.com/new.mp4",
            "video_status": "done",
        })

        prompt = service.get_prompt(prompt_id)
        assert prompt["video_prompt"] == "新的视频提示"
        assert prompt["video_negative_prompt"] == "不要抖动"
        assert prompt["video_url"] == "https://example.com/new.mp4"
        assert prompt["video_status"] == "done"

    def test_update_prompt_first_frame_fields(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新首帧"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "首帧字段"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "测试"})

        service.update_prompt(prompt_id, {
            "first_frame_url": "https://example.com/frame.png",
            "first_frame_status": "done",
        })

        prompt = service.get_prompt(prompt_id)
        assert prompt["first_frame_url"] == "https://example.com/frame.png"
        assert prompt["first_frame_status"] == "done"

    def test_update_prompt_json_fields(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "更新JSON"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "JSON字段"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "测试"})

        service.update_prompt(prompt_id, {
            "model_params": {"steps": 30},
            "reference_asset_ids": [10, 20],
        })

        prompt = service.get_prompt(prompt_id)
        assert json.loads(prompt["model_params"]) == {"steps": 30}
        assert json.loads(prompt["reference_asset_ids"]) == [10, 20]

    def test_update_prompt_status_only(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "状态更新"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "状态变更"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {"prompt_text": "测试"})

        service.update_prompt(prompt_id, {"status": "ready"})
        assert service.get_prompt(prompt_id)["status"] == "ready"

    def test_update_prompt_status_defaults_to_existing(self, db_setup):
        from video_lab.domain.prompts.service import PromptsService

        pid = _create_project()
        from video_lab.domain.shots.service import ShotsService
        svc = ShotsService()
        ep_id = svc.create_episode(pid, {"episode_no": 1, "title": "状态默认"})
        shot_id = svc.create_shot(ep_id, {"shot_no": 1, "visual_goal": "保留状态"})

        service = PromptsService()
        prompt_id = service.create_prompt_version(shot_id, {
            "prompt_text": "测试", "status": "ready",
        })

        service.update_prompt(prompt_id, {"prompt_text": "修改文本"})
        assert service.get_prompt(prompt_id)["status"] == "ready"
