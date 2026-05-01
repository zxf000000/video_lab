from __future__ import annotations

from ..common import normalize_json_text


class GenerationOrchestrator:
    """Async workflow coordinator for visual generation jobs."""

    def __init__(self, repository) -> None:
        self.repository = repository

    def build_task_payload(self, shot_id: int, prompt_id: int) -> dict:
        return {
            "shot_id": shot_id,
            "shot_prompt_id": prompt_id,
            "context": normalize_json_text({}, {}),
        }

    def handle_success(self, task_id: int, result: dict) -> None:
        self.repository.update_task(
            task_id,
            {
                "status": "succeeded",
                "output_assets": normalize_json_text(result.get("assets"), []),
                "finished_at": result.get("finished_at"),
            },
        )
