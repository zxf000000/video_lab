from __future__ import annotations

from .repository import StoryDevelopmentRepository
from .orchestrator import StoryDevelopmentOrchestrator


class StoryDevelopmentService:
    """Application service for the idea-to-screenplay chain."""

    def __init__(
        self,
        repository: StoryDevelopmentRepository | None = None,
        orchestrator: StoryDevelopmentOrchestrator | None = None,
    ) -> None:
        self.repository = repository or StoryDevelopmentRepository()
        self.orchestrator = orchestrator or StoryDevelopmentOrchestrator(self.repository)

    def generate_bible(self, project_id: int) -> int:
        raise NotImplementedError("StoryDevelopmentService.generate_bible is not implemented yet")

    def generate_episode_outline(self, project_id: int) -> int:
        raise NotImplementedError("StoryDevelopmentService.generate_episode_outline is not implemented yet")

