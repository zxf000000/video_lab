from __future__ import annotations

from ..common import DomainError, normalize_json_text, normalize_text
from .repository import PromptsRepository


class PromptsService:
    """Application service for prompt versioning and activation."""

    def __init__(self, repository: PromptsRepository | None = None) -> None:
        self.repository = repository or PromptsRepository()

    def create_prompt_version(self, shot_id: int, payload: dict) -> int:
        version_no = self.repository.get_next_version_no(shot_id)
        data = {
            "shot_id": shot_id,
            "version_no": version_no,
            "prompt_text": normalize_text(payload.get("prompt_text")),
            "first_frame_prompt": normalize_text(payload.get("first_frame_prompt")),
            "first_frame_negative_prompt": normalize_text(payload.get("first_frame_negative_prompt")),
            "video_prompt": normalize_text(payload.get("video_prompt")),
            "video_negative_prompt": normalize_text(payload.get("video_negative_prompt")),
            "negative_prompt": normalize_text(payload.get("negative_prompt")),
            "model_params": normalize_json_text(payload.get("model_params"), {}),
            "reference_asset_ids": normalize_json_text(payload.get("reference_asset_ids"), []),
            "status": normalize_text(payload.get("status"), "draft"),
            "is_active": 1 if bool(payload.get("is_active", False)) else 0,
        }
        if not data["prompt_text"] and not data["first_frame_prompt"]:
            raise DomainError("prompt_text or first_frame_prompt is required")
        if data["is_active"]:
            self.repository.deactivate_shot_prompts(shot_id)
        return self.repository.create_prompt(data)

    def activate_prompt(self, prompt_id: int) -> None:
        prompt = self.repository.get_prompt(prompt_id)
        if not prompt:
            raise DomainError("prompt not found")
        self.repository.deactivate_shot_prompts(int(prompt["shot_id"]))
        self.repository.update_prompt(prompt_id, {"is_active": 1, "status": "ready"})

    def list_prompts(self, shot_id: int) -> list[dict]:
        return self.repository.list_prompts(shot_id)

    def get_prompt(self, prompt_id: int) -> dict:
        prompt = self.repository.get_prompt(prompt_id)
        if not prompt:
            raise DomainError("prompt not found")
        return prompt

    def update_prompt(self, prompt_id: int, payload: dict) -> None:
        prompt = self.get_prompt(prompt_id)
        data = {}
        if "prompt_text" in payload:
            data["prompt_text"] = normalize_text(payload.get("prompt_text"))
        if "first_frame_prompt" in payload:
            data["first_frame_prompt"] = normalize_text(payload.get("first_frame_prompt"))
        if "first_frame_negative_prompt" in payload:
            data["first_frame_negative_prompt"] = normalize_text(payload.get("first_frame_negative_prompt"))
        if "video_prompt" in payload:
            data["video_prompt"] = normalize_text(payload.get("video_prompt"))
        if "video_negative_prompt" in payload:
            data["video_negative_prompt"] = normalize_text(payload.get("video_negative_prompt"))
        if "negative_prompt" in payload:
            data["negative_prompt"] = normalize_text(payload.get("negative_prompt"))
        if "model_params" in payload:
            data["model_params"] = normalize_json_text(payload.get("model_params"), {})
        if "reference_asset_ids" in payload:
            data["reference_asset_ids"] = normalize_json_text(payload.get("reference_asset_ids"), [])
        if "status" in payload:
            data["status"] = normalize_text(payload.get("status"), prompt.get("status", "draft"))
        if "is_active" in payload:
            if bool(payload.get("is_active")):
                self.repository.deactivate_shot_prompts(int(prompt["shot_id"]))
                data["is_active"] = 1
            else:
                data["is_active"] = 0
        self.repository.update_prompt(prompt_id, data)
