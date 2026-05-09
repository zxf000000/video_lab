"""Tests for scene derivation from screenplay — location matching, override CRUD, dedup logic."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class TestNormalizeLocation:
    def test_strips_time_suffix_day(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("总裁办公室 - 日")
        assert result == "总裁办公室"

    def test_strips_time_suffix_night(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("雨夜街头 - 夜")
        assert result == "雨夜街头"

    def test_preserves_location_without_suffix(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("别墅客厅")
        assert result == "别墅客厅"

    def test_lowercase_output(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("总裁办公室 - 日")
        assert result == "总裁办公室"

    def test_strips_evening_suffix(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("胡同口 — 黄昏")
        assert result == "胡同口"

    def test_strips_middle_dot_separator(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("咖啡厅·清晨")
        assert result == "咖啡厅"

    def test_handles_empty_string(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("")
        assert result == ""

    def test_no_false_positive_on_non_time_words(self):
        from video_lab.domain.assets.service import AssetsService
        result = AssetsService._normalize_location("日式料理店")
        assert result == "日式料理店"


class TestMatchLocationsToPresets:
    def test_exact_match(self):
        from video_lab.domain.assets.service import AssetsService
        svc = AssetsService()
        svc.repository = MagicMock()
        svc.repository.list_scene_presets.return_value = [
            {"id": 1, "name": "总裁办公室", "project_id": 1},
            {"id": 2, "name": "别墅客厅", "project_id": 1},
        ]
        result = svc.match_locations_to_presets(1, ["总裁办公室 - 日", "别墅客厅"])
        assert result == {"总裁办公室 - 日": 1, "别墅客厅": 2}

    def test_unmatched_returns_none(self):
        from video_lab.domain.assets.service import AssetsService
        svc = AssetsService()
        svc.repository = MagicMock()
        svc.repository.list_scene_presets.return_value = [
            {"id": 1, "name": "总裁办公室", "project_id": 1},
        ]
        result = svc.match_locations_to_presets(1, ["雨夜街头 - 夜"])
        assert result == {"雨夜街头 - 夜": None}

    def test_empty_presets_all_unmatched(self):
        from video_lab.domain.assets.service import AssetsService
        svc = AssetsService()
        svc.repository = MagicMock()
        svc.repository.list_scene_presets.return_value = []
        result = svc.match_locations_to_presets(1, ["总裁办公室", "别墅客厅"])
        assert result == {"总裁办公室": None, "别墅客厅": None}

    def test_empty_locations_returns_empty(self):
        from video_lab.domain.assets.service import AssetsService
        svc = AssetsService()
        svc.repository = MagicMock()
        svc.repository.list_scene_presets.return_value = [
            {"id": 1, "name": "总裁办公室", "project_id": 1},
        ]
        result = svc.match_locations_to_presets(1, [])
        assert result == {}

    def test_substring_match_office(self):
        from video_lab.domain.assets.service import AssetsService
        svc = AssetsService()
        svc.repository = MagicMock()
        svc.repository.list_scene_presets.return_value = [
            {"id": 1, "name": "办公室", "project_id": 1},
        ]
        # "陆总办公室" contains "办公室"
        result = svc.match_locations_to_presets(1, ["陆总办公室"])
        assert result["陆总办公室"] == 1


class TestDeriveOverrideFromLocation:
    def test_extracts_time_of_day_from_location_suffix(self):
        from video_lab.routes.generation_tasks import _derive_override_from_location

        screenplay_scenes = [{"scene_no": 1, "location": "总裁办公室 - 日", "summary": "test"}]
        preset = {"lighting_style": "自然光", "time_of_day": "", "weather": ""}
        result = _derive_override_from_location("总裁办公室 - 日", screenplay_scenes, preset)
        assert result["time_of_day"] == "日"
        assert result["lighting_style"] == "自然光"

    def test_fallback_to_preset_defaults(self):
        from video_lab.routes.generation_tasks import _derive_override_from_location

        screenplay_scenes = [{"scene_no": 1, "location": "其他地点 - 夜", "summary": "test"}]
        preset = {"lighting_style": "暖光", "time_of_day": "白天", "weather": "晴"}
        result = _derive_override_from_location("未知场景", screenplay_scenes, preset)
        assert result["time_of_day"] == "白天"
        assert result["lighting_style"] == "暖光"
        assert result["weather"] == "晴"

    def test_no_suffix_uses_preset_defaults(self):
        from video_lab.routes.generation_tasks import _derive_override_from_location

        screenplay_scenes = [{"scene_no": 1, "location": "别墅客厅", "summary": "test"}]
        preset = {"lighting_style": "自然光", "time_of_day": "日", "weather": "晴"}
        result = _derive_override_from_location("别墅客厅", screenplay_scenes, preset)
        assert result["time_of_day"] == "日"
        assert result["weather"] == "晴"


class TestLLMMatchLocations:
    def test_returns_empty_on_parse_failure(self):
        from video_lab.routes.generation_tasks import _llm_match_locations
        from unittest.mock import patch

        with patch("video_lab.routes.generation_tasks.ChatfireProvider") as mock_provider_cls:
            mock_provider = MagicMock()
            mock_provider._chat.return_value = "not valid json"
            mock_provider_cls.return_value = mock_provider

            result = _llm_match_locations(["陆总办公室"], ["总裁办公室"], 1)
            assert result == {}

    def test_returns_mapping_on_valid_json(self):
        from video_lab.routes.generation_tasks import _llm_match_locations
        from unittest.mock import patch

        with patch("video_lab.routes.generation_tasks.ChatfireProvider") as mock_provider_cls:
            mock_provider = MagicMock()
            mock_provider._chat.return_value = '{"陆总办公室": "总裁办公室"}'
            mock_provider_cls.return_value = mock_provider

            result = _llm_match_locations(["陆总办公室"], ["总裁办公室"], 1)
            assert result == {"陆总办公室": "总裁办公室"}

    def test_handles_markdown_code_block(self):
        from video_lab.routes.generation_tasks import _llm_match_locations
        from unittest.mock import patch

        with patch("video_lab.routes.generation_tasks.ChatfireProvider") as mock_provider_cls:
            mock_provider = MagicMock()
            mock_provider._chat.return_value = '```json\n{"陆总办公室": "总裁办公室"}\n```'
            mock_provider_cls.return_value = mock_provider

            result = _llm_match_locations(["陆总办公室"], ["总裁办公室"], 1)
            assert result == {"陆总办公室": "总裁办公室"}


@pytest.fixture()
def scene_override_setup(db_setup):
    """Create a project, episodes, and a scene preset for override tests."""
    from video_lab.domain.projects.service import ProjectsService
    from video_lab.domain.assets.repository import AssetsRepository
    from video_lab.domain.shots.repository import ShotsRepository
    from video_lab.domain.common import now_iso
    import datetime

    ps = ProjectsService()
    project_id = ps.create_project({
        "name": "测试项目",
        "genre": "都市短剧",
    })

    # Create episodes
    shots_repo = ShotsRepository()
    e1_id = shots_repo.create_episode({
        "project_id": project_id,
        "episode_no": 1,
        "title": "第一集",
        "summary": "",
        "goal": "",
        "core_conflict": "",
        "opening_hook": "",
        "climax": "",
        "ending_hook": "",
        "sort_order": 1,
        "status": "draft",
    })
    e2_id = shots_repo.create_episode({
        "project_id": project_id,
        "episode_no": 2,
        "title": "第二集",
        "summary": "",
        "goal": "",
        "core_conflict": "",
        "opening_hook": "",
        "climax": "",
        "ending_hook": "",
        "sort_order": 2,
        "status": "draft",
    })

    # Create a scene preset
    assets_repo = AssetsRepository()
    sp_id = assets_repo.create_scene_preset({
        "project_id": project_id,
        "name": "测试场景",
        "scene_type": "室内",
        "space_description": "",
        "lighting_style": "",
        "time_of_day": "",
        "weather": "",
        "prop_list": "[]",
        "reference_asset_ids": "[]",
        "variants": "[]",
        "status": "draft",
        "version_no": 1,
    })

    return {
        "project_id": project_id,
        "episode_ids": [e1_id, e2_id],
        "scene_preset_id": sp_id,
    }


class TestEpisodeSceneOverridesRepo:
    def test_create_and_get_override(self, scene_override_setup):
        from video_lab.domain.assets.repository import AssetsRepository
        repo = AssetsRepository()
        eid = scene_override_setup["episode_ids"][0]
        sid = scene_override_setup["scene_preset_id"]
        oid = repo.create_episode_scene_override(eid, sid, {
            "lighting_style": "自然光",
            "time_of_day": "日",
            "weather": "晴",
        })
        assert oid > 0
        override = repo.get_episode_scene_override(oid)
        assert override is not None
        assert override["episode_id"] == eid
        assert override["scene_preset_id"] == sid
        assert override["lighting_style"] == "自然光"

    def test_upsert_creates_new(self, scene_override_setup):
        from video_lab.domain.assets.repository import AssetsRepository
        repo = AssetsRepository()
        eid = scene_override_setup["episode_ids"][0]
        sid = scene_override_setup["scene_preset_id"]
        oid = repo.upsert_episode_scene_override(eid, sid, {"lighting_style": "暖光"})
        assert oid > 0
        override = repo.get_episode_scene_override(oid)
        assert override["lighting_style"] == "暖光"

    def test_upsert_updates_existing(self, scene_override_setup):
        from video_lab.domain.assets.repository import AssetsRepository
        repo = AssetsRepository()
        eid = scene_override_setup["episode_ids"][1]
        sid = scene_override_setup["scene_preset_id"]
        oid1 = repo.upsert_episode_scene_override(eid, sid, {"lighting_style": "冷光"})
        oid2 = repo.upsert_episode_scene_override(eid, sid, {"lighting_style": "暖光"})
        assert oid1 == oid2
        override = repo.get_episode_scene_override(oid2)
        assert override["lighting_style"] == "暖光"

    def test_update_override(self, scene_override_setup):
        from video_lab.domain.assets.repository import AssetsRepository
        repo = AssetsRepository()
        eid = scene_override_setup["episode_ids"][0]
        sid = scene_override_setup["scene_preset_id"]
        oid = repo.create_episode_scene_override(eid, sid, {"time_of_day": "日"})
        repo.update_episode_scene_override(oid, {"time_of_day": "夜", "weather": "雨"})
        override = repo.get_episode_scene_override(oid)
        assert override["time_of_day"] == "夜"
        assert override["weather"] == "雨"
        assert override["lighting_style"] == ""

    def test_list_overrides_for_preset(self, scene_override_setup):
        from video_lab.domain.assets.repository import AssetsRepository
        repo = AssetsRepository()
        e1 = scene_override_setup["episode_ids"][0]
        e2 = scene_override_setup["episode_ids"][1]
        sid = scene_override_setup["scene_preset_id"]
        repo.upsert_episode_scene_override(e1, sid, {"time_of_day": "日"})
        repo.upsert_episode_scene_override(e2, sid, {"time_of_day": "夜"})
        overrides = repo.list_overrides_for_preset(sid)
        assert isinstance(overrides, list)

