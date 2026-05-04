from __future__ import annotations

from ..common import DomainError, normalize_int, normalize_json_text, normalize_text
from .repository import ShotsRepository


class ShotsService:
    """Application service for episode and shot editing workflows."""

    def __init__(self, repository: ShotsRepository | None = None) -> None:
        self.repository = repository or ShotsRepository()

    def create_episode(self, project_id: int, payload: dict) -> int:
        episode_no = max(1, normalize_int(payload.get("episode_no") or payload.get("episode_number"), 1))
        data = {
            "project_id": project_id,
            "episode_no": episode_no,
            "title": normalize_text(payload.get("title"), f"第{episode_no}集"),
            "summary": normalize_text(payload.get("summary") or payload.get("outline_summary")),
            "goal": normalize_text(payload.get("goal")),
            "core_conflict": normalize_text(payload.get("core_conflict")),
            "opening_hook": normalize_text(payload.get("opening_hook")),
            "climax": normalize_text(payload.get("climax")),
            "ending_hook": normalize_text(payload.get("ending_hook")),
            "status": normalize_text(payload.get("status"), "draft"),
            "sort_order": normalize_int(payload.get("sort_order"), episode_no),
        }
        return self.repository.create_episode(data)

    def create_shot(self, episode_id: int, payload: dict) -> int:
        episode = self.repository.get_episode(episode_id)
        if not episode:
            raise DomainError("episode not found")
        shot_no = max(1, normalize_int(payload.get("shot_no"), 1))
        data = {
            "project_id": episode["project_id"],
            "episode_id": episode_id,
            "scene_block": normalize_text(payload.get("scene_block")),
            "shot_no": shot_no,
            "visual_goal": normalize_text(payload.get("visual_goal")),
            "character_ids": normalize_json_text(payload.get("character_ids"), []),
            "scene_preset_id": payload.get("scene_preset_id"),
            "shot_size": normalize_text(payload.get("shot_size")),
            "camera_angle": normalize_text(payload.get("camera_angle")),
            "composition": normalize_text(payload.get("composition")),
            "action_description": normalize_text(payload.get("action_description")),
            "facial_emotion": normalize_text(payload.get("facial_emotion")),
            "camera_motion": normalize_text(payload.get("camera_motion")),
            "dialogue_excerpt": normalize_text(payload.get("dialogue_excerpt")),
            "estimated_duration_ms": max(0, normalize_int(payload.get("estimated_duration_ms"), 0)),
            "status": normalize_text(payload.get("status"), "draft"),
            "sort_order": normalize_int(payload.get("sort_order"), shot_no),
        }
        return self.repository.create_shot(data)

    def list_episodes(self, project_id: int) -> list[dict]:
        return self.repository.list_episodes(project_id)

    def list_shots(self, episode_id: int) -> list[dict]:
        return self.repository.list_shots(episode_id)

    def update_episode(self, episode_id: int, payload: dict) -> None:
        existing = self.repository.get_episode(episode_id)
        if not existing:
            raise DomainError("episode not found")
        data = {}
        for key in ("title", "summary", "goal", "core_conflict", "opening_hook", "climax", "ending_hook", "status"):
            if key in payload:
                data[key] = normalize_text(payload.get(key))
        if "outline_summary" in payload and "summary" not in data:
            data["summary"] = normalize_text(payload.get("outline_summary"))
        if "episode_no" in payload or "episode_number" in payload:
            data["episode_no"] = max(1, normalize_int(payload.get("episode_no") or payload.get("episode_number"), existing["episode_no"]))
        if "sort_order" in payload:
            data["sort_order"] = normalize_int(payload.get("sort_order"), existing["sort_order"])
        self.repository.update_episode(episode_id, data)

    def update_shot(self, shot_id: int, payload: dict) -> None:
        existing = self.repository.get_shot(shot_id)
        if not existing:
            raise DomainError("shot not found")
        data = {}
        text_fields = (
            "scene_block",
            "visual_goal",
            "shot_size",
            "camera_angle",
            "composition",
            "action_description",
            "facial_emotion",
            "camera_motion",
            "dialogue_excerpt",
            "status",
        )
        for key in text_fields:
            if key in payload:
                data[key] = normalize_text(payload.get(key))
        if "character_ids" in payload:
            data["character_ids"] = normalize_json_text(payload.get("character_ids"), [])
        if "scene_preset_id" in payload:
            data["scene_preset_id"] = payload.get("scene_preset_id")
        if "shot_no" in payload:
            data["shot_no"] = max(1, normalize_int(payload.get("shot_no"), existing["shot_no"]))
        if "estimated_duration_ms" in payload:
            data["estimated_duration_ms"] = max(0, normalize_int(payload.get("estimated_duration_ms"), existing["estimated_duration_ms"]))
        if "sort_order" in payload:
            data["sort_order"] = normalize_int(payload.get("sort_order"), existing["sort_order"])
        self.repository.update_shot(shot_id, data)

    def get_episode(self, episode_id: int) -> dict:
        episode = self.repository.get_episode(episode_id)
        if not episode:
            raise DomainError("episode not found")
        return episode

    def get_shot(self, shot_id: int) -> dict:
        shot = self.repository.get_shot(shot_id)
        if not shot:
            raise DomainError("shot not found")
        return shot

    def delete_episode(self, episode_id: int) -> None:
        self.get_episode(episode_id)
        self.repository.delete_episode(episode_id)

    def delete_shot(self, shot_id: int) -> None:
        self.get_shot(shot_id)
        self.repository.delete_shot(shot_id)
