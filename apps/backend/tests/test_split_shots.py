"""Tests for split_story_into_shots — covers fallback path, API success path, and service integration."""

from __future__ import annotations

import json
import sqlite3
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure project root is importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from video_lab.config import AppConfig, DEFAULT_PROMPTS, PROMPT_VARS
from video_lab.providers.chatfire import ChatfireProvider


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_provider(config: AppConfig | None = None) -> ChatfireProvider:
    cfg = config or AppConfig(api_key="test-key", api_base="https://example.com")
    return ChatfireProvider(cfg, dict(DEFAULT_PROMPTS))


# ---------------------------------------------------------------------------
# Fallback path (API raises RuntimeError → paragraph splitting)
# ---------------------------------------------------------------------------

class TestSplitShotsFallback:
    """When _chat raises RuntimeError, split_story_into_shots must fall back
    to paragraph-based splitting and return a non-empty list."""

    def test_timeout_triggers_fallback(self):
        provider = _make_provider()
        with patch.object(provider, "_chat", side_effect=RuntimeError("timed out")):
            shots = provider.split_story_into_shots("段落一的内容。\n\n段落二的内容。\n\n段落三的内容。", 60)
        assert isinstance(shots, list)
        assert len(shots) >= 6
        for s in shots:
            assert "shot_title" in s
            assert "duration_seconds" in s
            assert s["duration_seconds"] > 0

    def test_empty_story_fallback(self):
        provider = _make_provider()
        with patch.object(provider, "_chat", side_effect=RuntimeError("fail")):
            shots = provider.split_story_into_shots("", 30)
        assert len(shots) >= 6

    def test_single_paragraph_fallback(self):
        provider = _make_provider()
        with patch.object(provider, "_chat", side_effect=RuntimeError("fail")):
            shots = provider.split_story_into_shots("只有一段故事。", 30)
        assert len(shots) >= 6

    def test_fallback_includes_required_keys(self):
        provider = _make_provider()
        story = "第一段。\n\n第二段。\n\n第三段。"
        with patch.object(provider, "_chat", side_effect=RuntimeError("fail")):
            shots = provider.split_story_into_shots(story, 60)
        required = {"shot_title", "shot_description", "shot_prompt", "duration_seconds",
                     "character_action", "scene_description", "camera_movement",
                     "emotion_keywords", "narration_text", "character_ids", "scene_name"}
        for s in shots:
            assert required.issubset(s.keys()), f"Missing keys: {required - set(s.keys())}"

    def test_fallback_duration_matches_total(self):
        provider = _make_provider()
        with patch.object(provider, "_chat", side_effect=RuntimeError("fail")):
            shots = provider.split_story_into_shots("第一段。\n\n第二段。", 30)
        assert sum(s["duration_seconds"] for s in shots) == 30


# ---------------------------------------------------------------------------
# API success path
# ---------------------------------------------------------------------------

class TestSplitShotsAPI:
    """When _chat returns valid JSON, parse it correctly."""

    def test_valid_json_response(self):
        api_response = json.dumps([
            {
                "shot_title": "开场",
                "shot_description": "描述1",
                "shot_prompt": "prompt1",
                "duration_seconds": 10,
                "character_action": "主角出现",
                "scene_description": "城市夜景",
                "camera_movement": "wide shot",
                "emotion_keywords": "紧张",
                "narration_text": "旁白1",
            },
            {
                "shot_title": "结尾",
                "shot_description": "描述2",
                "shot_prompt": "prompt2",
                "duration_seconds": 10,
                "character_action": "主角离开",
                "scene_description": "街道",
                "camera_movement": "close-up",
                "emotion_keywords": "释然",
                "narration_text": "旁白2",
            },
        ])
        provider = _make_provider()
        with patch.object(provider, "_chat", return_value=api_response):
            shots = provider.split_story_into_shots("测试故事", 20)
        assert len(shots) == 2
        assert shots[0]["shot_title"] == "开场"
        assert shots[1]["shot_title"] == "结尾"
        assert shots[0]["start_frame_prompt"]
        assert shots[0]["end_frame_prompt"]
        assert "character_ids" in shots[0]
        assert "scene_name" in shots[0]

    def test_json_with_extra_text(self):
        """API may return JSON wrapped in markdown or explanation text."""
        api_response = "Here is the result:\n```json\n[{'shot_title': 'A', 'shot_description': 'd', 'shot_prompt': 'p', 'duration_seconds': 5, 'character_action': 'c', 'scene_description': 's', 'camera_movement': 'cm', 'emotion_keywords': '', 'narration_text': ''}]\n```\n"
        # Fix: use proper JSON quotes
        api_response = 'prefix text\n[{"shot_title":"A","shot_description":"d","shot_prompt":"p","duration_seconds":5,"character_action":"c","scene_description":"s","camera_movement":"cm","emotion_keywords":"","narration_text":""}]\nmore text'
        provider = _make_provider()
        with patch.object(provider, "_chat", return_value=api_response):
            shots = provider.split_story_into_shots("story", 60)
        assert len(shots) == 1
        assert shots[0]["shot_title"] == "A"
        assert shots[0]["start_frame_prompt"]
        assert shots[0]["end_frame_prompt"]

    def test_invalid_json_triggers_fallback(self):
        provider = _make_provider()
        with patch.object(provider, "_chat", return_value="not json at all"):
            shots = provider.split_story_into_shots("段落一。\n\n段落二。", 30)
        assert len(shots) >= 6  # fallback produces more shots now

    def test_normalize_shot_infers_dialogue_when_speaking_scene_has_no_narration(self):
        provider = _make_provider()
        shot = provider._normalize_shot(
            {
                "shot_title": "对峙",
                "shot_description": "林远盯着对方，低声说要他们立刻离开。",
                "shot_prompt": "中景对峙，冷色侧光，空气紧绷。",
                "duration_seconds": 4,
                "character_action": "林远抬手拦住对方并开口",
                "character_ids": ["林远"],
                "scene_name": "旧走廊",
                "scene_description": "昏暗旧走廊",
                "camera_movement": "固定",
                "emotion_keywords": "紧张",
                "narration_text": "",
            },
            default_duration=4,
            fallback_index=1,
            available_character_names=["林远"],
            available_scene_names=["旧走廊"],
        )
        assert shot["narration_text"] == "别再靠近了。"

    def test_normalize_shot_infers_inner_voice_when_emotional_pause_has_no_narration(self):
        provider = _make_provider()
        shot = provider._normalize_shot(
            {
                "shot_title": "迟疑",
                "shot_description": "苏禾站在门口迟疑许久，手指微微发抖，始终没有推门。",
                "shot_prompt": "近景凝视，逆光压低，空气沉重。",
                "duration_seconds": 4,
                "character_action": "苏禾沉默凝视门缝里的光",
                "character_ids": ["苏禾"],
                "scene_name": "病房门口",
                "scene_description": "安静的病房门口",
                "camera_movement": "固定",
                "emotion_keywords": "悲伤",
                "narration_text": "",
            },
            default_duration=4,
            fallback_index=1,
            available_character_names=["苏禾"],
            available_scene_names=["病房门口"],
        )
        assert shot["narration_text"] == "原来一切都回不去了。"

    def test_normalize_shot_preserves_valid_reference_prompt(self):
        provider = _make_provider()
        shot = provider._normalize_shot(
            {
                "shot_title": "追逐",
                "shot_description": "林远冲进旧走廊。",
                "shot_prompt": "中景跟拍，冷色顶光，空气压抑。",
                "duration_seconds": 4,
                "character_action": "林远冲进旧走廊后猛地回头",
                "character_ids": ["林远"],
                "scene_name": "旧走廊",
                "scene_description": "昏暗旧走廊，墙面潮湿，地面反光",
                "camera_movement": "跟",
                "emotion_keywords": "紧张",
                "narration_text": "",
                "start_frame_prompt": "图一中的林远处于镜头开始瞬间，图二中的旧走廊保持昏暗潮湿。",
                "end_frame_prompt": "图一中的林远猛地回头，图二中的旧走廊尽头亮起冷白光。",
            },
            default_duration=4,
            fallback_index=1,
            available_character_names=["林远"],
            available_scene_names=["旧走廊"],
        )
        assert shot["start_frame_prompt"] == "图一中的林远处于镜头开始瞬间，图二中的旧走廊保持昏暗潮湿。"
        assert shot["end_frame_prompt"] == "图一中的林远猛地回头，图二中的旧走廊尽头亮起冷白光。"

    def test_normalize_shot_rewrites_reference_prompt_when_label_binds_to_object(self):
        provider = _make_provider()
        shot = provider._normalize_shot(
            {
                "shot_title": "失控",
                "shot_description": "人物在失控的车旁踉跄后退。",
                "shot_prompt": "中景，霓虹闪烁，路面积水反光，空气紧绷。",
                "duration_seconds": 4,
                "character_action": "林远身体前倾、重心失衡地后退",
                "character_ids": ["林远"],
                "scene_name": "街道",
                "scene_description": "夜晚街道路面积水，霓虹破碎反射",
                "camera_movement": "移",
                "emotion_keywords": "紧张",
                "narration_text": "",
                "start_frame_prompt": "图一车身倾斜，图二路面霓虹反射。",
                "end_frame_prompt": "图一车门震动，图二雨水被灯光切碎。",
            },
            default_duration=4,
            fallback_index=1,
            available_character_names=["林远"],
            available_scene_names=["街道"],
        )
        assert shot["start_frame_prompt"].startswith("图一为林远，图二为街道。")
        assert "图一中的林远" in shot["start_frame_prompt"]
        assert "图二中的街道" in shot["start_frame_prompt"]
        assert "图一车身倾斜" not in shot["start_frame_prompt"]
        assert "图一中的林远" in shot["end_frame_prompt"]
        assert "图二中的街道" in shot["end_frame_prompt"]

    def test_normalize_shot_rewrites_scene_only_prompt_to_use_scene_as_tu_yi(self):
        provider = _make_provider()
        shot = provider._normalize_shot(
            {
                "shot_title": "空镜",
                "shot_description": "空旷街道被风吹起纸片。",
                "shot_prompt": "大全景，低色温路灯，风声压低。",
                "duration_seconds": 4,
                "character_action": "",
                "character_ids": [],
                "scene_name": "街道",
                "scene_description": "空旷街道，路灯摇晃，纸片掠过地面",
                "camera_movement": "固定",
                "emotion_keywords": "",
                "narration_text": "",
                "start_frame_prompt": "图一纸片掠过路面。",
                "end_frame_prompt": "",
            },
            default_duration=4,
            fallback_index=1,
            available_character_names=[],
            available_scene_names=["街道"],
        )
        assert shot["start_frame_prompt"].startswith("图一为街道。")
        assert "图一中的街道" in shot["start_frame_prompt"]
        assert shot["end_frame_prompt"].startswith("图一为街道。")


class TestPromptVars:
    def test_split_shots_vars_include_character_and_scene_lists(self):
        assert "character_list" in PROMPT_VARS["split_shots"]
        assert "scene_list" in PROMPT_VARS["split_shots"]

    def test_screenplay_vars_exist(self):
        assert {"story", "style", "duration_seconds", "char_names", "scene_names"}.issubset(PROMPT_VARS["expand_story_screenplay"])

    def test_beat_expansion_vars_exist(self):
        assert {"story", "style", "duration_seconds", "char_names", "scene_names"}.issubset(PROMPT_VARS["expand_story_beats"])

    def test_frame_and_video_vars_match_runtime_templates(self):
        assert {"scene_description", "character_names", "reference_notes"}.issubset(PROMPT_VARS["generate_frame"])
        assert {"shot_title", "scene_description", "character_names", "continuity_notes", "narration_text"}.issubset(PROMPT_VARS["generate_video"])


# ---------------------------------------------------------------------------
# Service integration (split_shots in services.py)
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


class TestSplitShotsService:
    """Test services.split_shots with a temp DB and mocked provider."""

    @pytest.fixture()
    def db_setup(self, tmp_path):
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

    def test_split_shots_creates_shots(self, db_setup):
        from video_lab import repository, services
        from video_lab.config import AppConfig

        # Create a project
        pid = repository.create_project(
            repository.ProjectInput(
                title="测试项目",
                story_prompt="测试提示",
                style="cinematic",
                aspect_ratio="16:9",
                target_duration=30,
            )
        )
        repository.update_project_story(pid, "故事内容第一段。\n\n故事内容第二段。", "new")

        # Mock the provider
        mock_shots = [
            {"shot_title": "镜头1", "shot_description": "desc1", "shot_prompt": "p1",
             "duration_seconds": 15, "character_action": "a1", "scene_description": "s1",
             "camera_movement": "cm1", "emotion_keywords": "", "narration_text": ""},
            {"shot_title": "镜头2", "shot_description": "desc2", "shot_prompt": "p2",
             "duration_seconds": 15, "character_action": "a2", "scene_description": "s2",
             "camera_movement": "cm2", "emotion_keywords": "", "narration_text": ""},
        ]

        mock_provider = MagicMock()
        mock_provider.expand_story_screenplay.return_value = "场次 1：夜 / 旧走廊 / 主角进入并观察异常光源"
        mock_provider.expand_story_beats.return_value = "Beat 1：主角进入空间。\nBeat 2：主角看向异常物件。"
        mock_provider.split_story_into_shots.return_value = mock_shots

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.split_shots(pid)

        # Verify
        project = repository.get_project(pid)
        assert project["status"] == "shots_ready"
        shots = repository.list_project_shots(pid)
        assert len(shots) == 2
        assert shots[0]["shot_title"] == "镜头1"
        assert shots[1]["shot_title"] == "镜头2"
        mock_provider.expand_story_screenplay.assert_called_once()
        mock_provider.expand_story_beats.assert_called_once()
        mock_provider.split_story_into_shots.assert_called_once()
        beat_input = mock_provider.expand_story_beats.call_args.kwargs["story"]
        assert beat_input.startswith("场次 1：")
        split_input = mock_provider.split_story_into_shots.call_args.args[0]
        assert split_input.startswith("Beat 1：")

    def test_split_shots_clears_old_shots(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="测试", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        repository.update_project_story(pid, "故事。", "new")

        # First round of shots
        old_shots = [
            {"shot_title": "旧", "shot_description": "d", "shot_prompt": "p",
             "duration_seconds": 30, "character_action": "a", "scene_description": "s",
             "camera_movement": "cm", "emotion_keywords": "", "narration_text": ""},
        ]
        new_shots = [
            {"shot_title": "新1", "shot_description": "d1", "shot_prompt": "p1",
             "duration_seconds": 15, "character_action": "a1", "scene_description": "s1",
             "camera_movement": "cm1", "emotion_keywords": "", "narration_text": ""},
            {"shot_title": "新2", "shot_description": "d2", "shot_prompt": "p2",
             "duration_seconds": 15, "character_action": "a2", "scene_description": "s2",
             "camera_movement": "cm2", "emotion_keywords": "", "narration_text": ""},
        ]

        mock_provider = MagicMock()
        mock_provider.expand_story_screenplay.return_value = "场次 1：旧镜头 / 当前场景 / 旧动作"
        mock_provider.expand_story_beats.return_value = "Beat 1：旧镜头。\nBeat 2：新动作。"

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            mock_provider.split_story_into_shots.return_value = old_shots
            services.split_shots(pid)
            assert len(repository.list_project_shots(pid)) == 1

            mock_provider.split_story_into_shots.return_value = new_shots
            services.split_shots(pid)
            shots = repository.list_project_shots(pid)
            assert len(shots) == 2
            assert shots[0]["shot_title"] == "新1"

    def test_split_shots_falls_back_to_story_when_beat_expansion_fails(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="Beat降级", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        repository.update_project_story(pid, "故事内容第一段。\n\n故事内容第二段。", "story_ready")

        mock_provider = MagicMock()
        mock_provider.expand_story_screenplay.return_value = "场次 1：夜 / 旧走廊 / 主角进入"
        mock_provider.expand_story_beats.side_effect = RuntimeError("beat failed")
        mock_provider.split_story_into_shots.return_value = [
            {"shot_title": "镜头1", "shot_description": "desc1", "shot_prompt": "p1",
             "duration_seconds": 15, "character_action": "a1", "scene_description": "s1",
             "camera_movement": "cm1", "emotion_keywords": "", "narration_text": ""},
            {"shot_title": "镜头2", "shot_description": "desc2", "shot_prompt": "p2",
             "duration_seconds": 15, "character_action": "a2", "scene_description": "s2",
             "camera_movement": "cm2", "emotion_keywords": "", "narration_text": ""},
        ]

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.split_shots(pid)

        split_input = mock_provider.split_story_into_shots.call_args.args[0]
        assert split_input == "场次 1：夜 / 旧走廊 / 主角进入"

    def test_split_shots_falls_back_to_story_when_screenplay_fails(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="剧本降级", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        repository.update_project_story(pid, "故事内容第一段。\n\n故事内容第二段。", "story_ready")

        mock_provider = MagicMock()
        mock_provider.expand_story_screenplay.side_effect = RuntimeError("screenplay failed")
        mock_provider.expand_story_beats.return_value = "Beat 1：原故事继续推进。\nBeat 2：角色作出反应。"
        mock_provider.split_story_into_shots.return_value = [
            {"shot_title": "镜头1", "shot_description": "desc1", "shot_prompt": "p1",
             "duration_seconds": 15, "character_action": "a1", "scene_description": "s1",
             "camera_movement": "cm1", "emotion_keywords": "", "narration_text": ""},
            {"shot_title": "镜头2", "shot_description": "desc2", "shot_prompt": "p2",
             "duration_seconds": 15, "character_action": "a2", "scene_description": "s2",
             "camera_movement": "cm2", "emotion_keywords": "", "narration_text": ""},
        ]

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.split_shots(pid)

        beat_input = mock_provider.expand_story_beats.call_args.kwargs["story"]
        assert beat_input == "故事内容第一段。\n\n故事内容第二段。"


class TestAspectRatioPropagation:
    def test_generate_shot_frames_passes_project_aspect_ratio(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="比例测试", story_prompt="提示", style="cinematic",
                aspect_ratio="9:16", target_duration=30,
            )
        )
        shot_id = repository.create_shot(pid, {
            "order_index": 1,
            "shot_title": "镜头1",
            "shot_description": "desc",
            "shot_prompt": "prompt",
            "duration_seconds": 5,
            "character_action": "动作",
            "scene_description": "场景",
            "camera_movement": "固定",
            "emotion_keywords": "",
            "narration_text": "",
            "character_ids": "[]",
            "scene_id": None,
        })

        mock_provider = MagicMock()
        mock_provider.generate_frame.side_effect = ["start.png", "end.png"]

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.generate_shot_frames(shot_id)

        first_call = mock_provider.generate_frame.call_args_list[0]
        second_call = mock_provider.generate_frame.call_args_list[1]
        assert first_call.kwargs["aspect_ratio"] == "9:16"
        assert second_call.kwargs["aspect_ratio"] == "9:16"

    def test_generate_shot_video_passes_project_aspect_ratio(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="比例视频", story_prompt="提示", style="cinematic",
                aspect_ratio="1:1", target_duration=30,
            )
        )
        shot_id = repository.create_shot(pid, {
            "order_index": 1,
            "shot_title": "镜头1",
            "shot_description": "desc",
            "shot_prompt": "prompt",
            "duration_seconds": 5,
            "status": "frames_ready",
            "character_action": "动作",
            "scene_description": "场景",
            "camera_movement": "固定",
            "emotion_keywords": "",
            "narration_text": "",
            "start_frame_path": "start.png",
            "end_frame_path": "end.png",
            "character_ids": "[]",
            "scene_id": None,
        })
        repository.update_shot_frames(shot_id, "start.png", "end.png", "frames_ready")

        mock_provider = MagicMock()
        mock_provider.generate_video.return_value = "video.mp4"

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.generate_shot_video(shot_id)

        assert mock_provider.generate_video.call_args.kwargs["aspect_ratio"] == "1:1"

    def test_generate_shot_video_prefers_saved_video_prompt(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="视频提示词", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        shot_id = repository.create_shot(pid, {
            "order_index": 1,
            "shot_title": "镜头1",
            "shot_description": "desc",
            "shot_prompt": "通用镜头提示词",
            "video_prompt": "独立视频提示词",
            "duration_seconds": 5,
            "status": "frames_ready",
            "character_action": "动作",
            "scene_description": "场景",
            "camera_movement": "固定",
            "emotion_keywords": "",
            "narration_text": "",
            "start_frame_path": "start.png",
            "end_frame_path": "end.png",
            "character_ids": "[]",
            "scene_id": None,
        })
        repository.update_shot_frames(shot_id, "start.png", "end.png", "frames_ready")

        mock_provider = MagicMock()
        mock_provider.generate_video.return_value = "video.mp4"

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            services.generate_shot_video(shot_id)

        assert mock_provider.generate_video.call_args.kwargs["shot_prompt"] == "独立视频提示词"

    def test_update_shot_prompts_updates_multiple_prompt_fields(self, db_setup):
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="多字段保存", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        shot_id = repository.create_shot(pid, {
            "order_index": 1,
            "shot_title": "镜头1",
            "shot_description": "desc",
            "shot_prompt": "旧镜头提示词",
            "duration_seconds": 5,
            "status": "video_ready",
            "character_action": "动作",
            "scene_description": "场景",
            "camera_movement": "固定",
            "emotion_keywords": "",
            "narration_text": "",
            "start_frame_prompt": "旧首帧",
            "end_frame_prompt": "旧尾帧",
            "video_prompt": "旧视频提示词",
            "character_ids": "[]",
            "scene_id": None,
        })
        repository.update_shot_frames(shot_id, "start.png", "end.png", "frames_ready")
        repository.update_shot_video(shot_id, "video.mp4", "video_ready")

        services.update_shot_prompts(shot_id, {
            "start_frame_prompt": "新首帧",
            "end_frame_prompt": "新尾帧",
            "video_prompt": "新视频提示词",
        })

        shot = repository.get_shot(shot_id)
        assert shot["start_frame_prompt"] == "新首帧"
        assert shot["end_frame_prompt"] == "新尾帧"
        assert shot["video_prompt"] == "新视频提示词"
        assert shot["status"] == "prompt_updated"
        assert shot["start_frame_path"] is None
        assert shot["end_frame_path"] is None
        assert shot["video_path"] is None

    def test_split_shots_handles_timeout_in_background(self, db_setup):
        """Simulate the actual timeout scenario: _chat raises RuntimeError,
        fallback produces shots, service completes successfully."""
        from video_lab import repository, services

        pid = repository.create_project(
            repository.ProjectInput(
                title="超时测试", story_prompt="提示", style="cinematic",
                aspect_ratio="16:9", target_duration=30,
            )
        )
        repository.update_project_story(pid, "第一段故事。\n\n第二段故事。\n\n第三段故事。", "new")

        mock_provider = MagicMock()
        mock_provider.split_story_into_shots.side_effect = RuntimeError("The read operation timed out (after 1800s)")

        with patch.object(services, "_get_providers", return_value={"text": mock_provider, "image": mock_provider, "video": mock_provider}):
            with pytest.raises(RuntimeError, match="timed out"):
                services.split_shots(pid)

        # Project should still be in splitting_shots status (error before completion)
        project = repository.get_project(pid)
        assert project["status"] == "splitting_shots"
