from __future__ import annotations


class StoryDevelopmentOrchestrator:
    """Workflow coordinator for idea->bible->outline->screenplay generation."""

    def __init__(self, repository) -> None:
        self.repository = repository

    def assemble_context(self, project_id: int, stage: str) -> dict:
        raise NotImplementedError("StoryDevelopmentOrchestrator.assemble_context is not implemented yet")

    def run_consistency_check(self, entity_type: str, entity_id: int) -> dict:
        raise NotImplementedError("StoryDevelopmentOrchestrator.run_consistency_check is not implemented yet")

