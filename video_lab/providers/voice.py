from __future__ import annotations


class NoOpProvider:
    """Voice provider placeholder — returns empty string."""

    def generate_narration(self, text: str, voice_profile: str, shot_id: int) -> str:
        return ""
