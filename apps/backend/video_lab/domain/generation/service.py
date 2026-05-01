from __future__ import annotations

from ..common import DomainError, normalize_json_text, normalize_text
from ..prompts.repository import PromptsRepository
from ..shots.repository import ShotsRepository
from .repository import GenerationRepository
from .orchestrator import GenerationOrchestrator


class GenerationService:
    """Application service for task submission, retry, and status queries."""

    def __init__(
        self,
        repository: GenerationRepository | None = None,
        orchestrator: GenerationOrchestrator | None = None,
    ) -> None:
        self.repository = repository or GenerationRepository()
        self.orchestrator = orchestrator or GenerationOrchestrator(self.repository)
        self.prompts_repository = PromptsRepository()
        self.shots_repository = ShotsRepository()

    def submit_shot_generation(self, shot_id: int, payload: dict) -> int:
        shot = self.shots_repository.get_shot(shot_id)
        if not shot:
            raise DomainError("shot not found")
        prompt_id = payload.get("shot_prompt_id")
        prompt = None
        if prompt_id:
            prompt = self.prompts_repository.get_prompt(int(prompt_id))
        else:
            prompt = self.prompts_repository.get_active_prompt_for_shot(shot_id)
        if not prompt:
            raise DomainError("active prompt not found")
        episode = self.shots_repository.get_episode(int(shot["episode_id"]))
        if not episode:
            raise DomainError("episode not found")
        task_payload = {
            "project_id": episode["project_id"],
            "episode_id": episode["id"],
            "shot_id": shot_id,
            "shot_prompt_id": prompt["id"],
            "provider": normalize_text(payload.get("provider"), "mock"),
            "model_name": normalize_text(payload.get("model_name"), "mock-model"),
            "status": "queued",
            "input_payload": normalize_json_text(
                {
                    "shot_id": shot_id,
                    "shot_prompt_id": prompt["id"],
                    "prompt_text": prompt["prompt_text"],
                },
                {},
            ),
            "output_assets": normalize_json_text([], []),
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        }
        return self.repository.create_task(task_payload)

    def submit_episode_batch(self, episode_id: int, payload: dict) -> list[int]:
        shots = self.shots_repository.list_shots(episode_id)
        task_ids: list[int] = []
        for shot in shots:
            active_prompt = self.prompts_repository.get_active_prompt_for_shot(int(shot["id"]))
            if not active_prompt:
                continue
            task_ids.append(
                self.submit_shot_generation(
                    int(shot["id"]),
                    {
                        "provider": payload.get("provider"),
                        "model_name": payload.get("model_name"),
                        "shot_prompt_id": active_prompt["id"],
                    },
                )
            )
        return task_ids

    def retry_task(self, task_id: int) -> None:
        task = self.repository.get_task(task_id)
        if not task:
            raise DomainError("task not found")
        self.repository.update_task(
            task_id,
            {
                "status": "queued",
                "retry_count": int(task.get("retry_count", 0)) + 1,
                "error_message": "",
                "finished_at": None,
            },
        )

    def get_task(self, task_id: int) -> dict:
        task = self.repository.get_task(task_id)
        if not task:
            raise DomainError("task not found")
        return task

    def list_tasks_for_episode(self, episode_id: int) -> list[dict]:
        return self.repository.list_tasks_for_episode(episode_id)

    def list_tasks_for_project(self, project_id: int) -> list[dict]:
        return self.repository.list_tasks_for_project(project_id)
