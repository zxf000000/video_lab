from __future__ import annotations

from ...db import get_connection


class StoryDevelopmentRepository:
    """Repository boundary for idea, bible, outline, scene beats, and screenplay objects."""

    def get_connection(self):
        return get_connection()

    def get_project_brief(self, project_id: int):
        raise NotImplementedError("StoryDevelopmentRepository.get_project_brief is not implemented yet")

