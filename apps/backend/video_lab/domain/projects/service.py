from __future__ import annotations

from ..common import DomainError, normalize_int, normalize_json_text, normalize_text
from .repository import ProjectsRepository


class ProjectsService:
    """Application service for project lifecycle and overview composition."""

    def __init__(self, repository: ProjectsRepository | None = None) -> None:
        self.repository = repository or ProjectsRepository()

    def create_project(self, payload: dict) -> int:
        name = normalize_text(payload.get("name") or payload.get("title"))
        if not name:
            raise DomainError("name is required")
        data = {
            "name": name,
            "genre": normalize_text(payload.get("genre")),
            "target_platform": normalize_text(payload.get("target_platform")),
            "episode_count_planned": max(1, normalize_int(payload.get("episode_count_planned"), 30)),
            "current_stage": normalize_text(payload.get("current_stage"), "draft"),
            "status": normalize_text(payload.get("status"), "draft"),
            "logline": normalize_text(payload.get("logline")),
            "target_audience": normalize_text(payload.get("target_audience")),
            "genre_tags": normalize_json_text(payload.get("genre_tags"), []),
            "style_keywords": normalize_json_text(payload.get("style_keywords"), []),
            "world_rules": normalize_text(payload.get("world_rules")),
            "main_conflict": normalize_text(payload.get("main_conflict")),
            "relationship_summary": normalize_text(payload.get("relationship_summary")),
            "reversal_rules": normalize_text(payload.get("reversal_rules")),
            "forbidden_rules": normalize_text(payload.get("forbidden_rules")),
            "brief_status": normalize_text(payload.get("brief_status"), "draft"),
        }
        return self.repository.create(data)

    def get_overview(self, project_id: int) -> dict:
        project = self.repository.get(project_id)
        if not project:
            raise DomainError("project not found")
        brief = self.repository.get_brief(project_id)
        return {
            "project": project,
            "brief": brief,
        }

    def list_projects(self) -> list[dict]:
        return self.repository.list()

    def update_project(self, project_id: int, payload: dict) -> None:
        if not self.repository.get(project_id):
            raise DomainError("project not found")
        data = {}
        if "name" in payload or "title" in payload:
            data["name"] = normalize_text(payload.get("name") or payload.get("title"))
        if "genre" in payload:
            data["genre"] = normalize_text(payload.get("genre"))
        if "target_platform" in payload:
            data["target_platform"] = normalize_text(payload.get("target_platform"))
        if "episode_count_planned" in payload:
            data["episode_count_planned"] = max(1, normalize_int(payload.get("episode_count_planned"), 30))
        if "current_stage" in payload:
            data["current_stage"] = normalize_text(payload.get("current_stage"), "draft")
        if "status" in payload:
            data["status"] = normalize_text(payload.get("status"), "draft")
        self.repository.update(project_id, data)

    def get_brief(self, project_id: int) -> dict:
        if not self.repository.get(project_id):
            raise DomainError("project not found")
        brief = self.repository.get_brief(project_id)
        return brief or {}

    def upsert_brief(self, project_id: int, payload: dict) -> None:
        if not self.repository.get(project_id):
            raise DomainError("project not found")
        data = {
            "logline": normalize_text(payload.get("logline")),
            "target_audience": normalize_text(payload.get("target_audience")),
            "genre_tags": normalize_json_text(payload.get("genre_tags"), []),
            "style_keywords": normalize_json_text(payload.get("style_keywords"), []),
            "world_rules": normalize_text(payload.get("world_rules")),
            "main_conflict": normalize_text(payload.get("main_conflict")),
            "relationship_summary": normalize_text(payload.get("relationship_summary")),
            "reversal_rules": normalize_text(payload.get("reversal_rules")),
            "forbidden_rules": normalize_text(payload.get("forbidden_rules")),
            "status": normalize_text(payload.get("status"), "draft"),
        }
        self.repository.upsert_brief(project_id, data)

    def delete_project(self, project_id: int) -> None:
        if not self.repository.get(project_id):
            raise DomainError("project not found")
        self.repository.delete(project_id)

    def delete_projects(self, project_ids: list[int]) -> int:
        """Batch-delete projects. Returns count of deleted projects."""
        ids = [int(i) for i in project_ids if int(i) > 0]
        if not ids:
            return 0
        return self.repository.delete_many(ids)
