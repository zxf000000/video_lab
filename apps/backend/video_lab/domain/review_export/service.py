from __future__ import annotations

from ..common import DomainError, normalize_json_text, normalize_text
from .repository import ReviewExportRepository


class ReviewExportService:
    """Application service for review resolution and export assembly."""

    def __init__(self, repository: ReviewExportRepository | None = None) -> None:
        self.repository = repository or ReviewExportRepository()

    def create_review_issue(self, payload: dict) -> int:
        data = {
            "project_id": payload["project_id"],
            "episode_id": payload.get("episode_id"),
            "shot_id": payload.get("shot_id"),
            "generation_task_id": payload.get("generation_task_id"),
            "issue_type": normalize_text(payload.get("issue_type")),
            "severity": normalize_text(payload.get("severity"), "medium"),
            "description": normalize_text(payload.get("description")),
            "rework_target_type": normalize_text(payload.get("rework_target_type"), "shot_prompt"),
            "resolution_status": normalize_text(payload.get("resolution_status"), "open"),
            "resolved_at": payload.get("resolved_at"),
        }
        if not data["issue_type"]:
            raise DomainError("issue_type is required")
        return self.repository.create_review_issue(data)

    def create_episode_export(self, episode_id: int, payload: dict) -> int:
        version_no = self.repository.get_next_export_version_no(episode_id)
        data = {
            "episode_id": episode_id,
            "version_no": version_no,
            "selected_task_ids": normalize_json_text(payload.get("selected_task_ids"), []),
            "timeline_data": normalize_json_text(payload.get("timeline_data"), {}),
            "subtitle_data": normalize_json_text(payload.get("subtitle_data"), {}),
            "audio_data": normalize_json_text(payload.get("audio_data"), {}),
            "preview_url": normalize_text(payload.get("preview_url")),
            "export_url": normalize_text(payload.get("export_url")),
            "status": normalize_text(payload.get("status"), "draft"),
        }
        return self.repository.create_episode_export(data)

    def list_review_issues(self, episode_id: int) -> list[dict]:
        return self.repository.list_review_issues(episode_id)

    def resolve_review_issue(self, issue_id: int, payload: dict) -> None:
        issue = self.repository.get_review_issue(issue_id)
        if not issue:
            raise DomainError("review issue not found")
        data = {
            "resolution_status": normalize_text(payload.get("resolution_status"), "resolved"),
            "resolved_at": payload.get("resolved_at"),
        }
        self.repository.update_review_issue(issue_id, data)

    def list_episode_exports(self, episode_id: int) -> list[dict]:
        return self.repository.list_episode_exports(episode_id)

    def render_episode_export(self, export_id: int, payload: dict) -> None:
        existing = self.repository.get_episode_export(export_id)
        if not existing:
            raise DomainError("episode export not found")
        self.repository.update_episode_export(
            export_id,
            {
                "preview_url": normalize_text(payload.get("preview_url"), existing.get("preview_url", "")),
                "export_url": normalize_text(payload.get("export_url"), existing.get("export_url", "")),
                "status": normalize_text(payload.get("status"), "exported"),
            },
        )
