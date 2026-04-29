from __future__ import annotations

from typing import Protocol


class TextProvider(Protocol):
    def generate_story(
        self, title: str, prompt: str, style: str, duration_seconds: int,
        characters: list[dict] | None = None, scenes: list[dict] | None = None,
    ) -> str: ...

    def expand_story_beats(
        self,
        story: str,
        style: str,
        duration_seconds: int,
        characters: list[dict] | None = None,
        scenes: list[dict] | None = None,
    ) -> tuple[str, str]: ...

    def expand_story_screenplay(
        self,
        story: str,
        style: str,
        duration_seconds: int,
        characters: list[dict] | None = None,
        scenes: list[dict] | None = None,
    ) -> tuple[str, str]: ...

    def split_story_into_shots(
        self,
        story: str,
        duration_seconds: int,
        characters: list[dict] | None = None,
        scenes: list[dict] | None = None,
    ) -> list[dict]: ...

    def generate_characters(self, story: str, style: str) -> list[dict]: ...

    def generate_scenes(self, story: str, style: str) -> list[dict]: ...


class ImageProvider(Protocol):
    def generate_frame(
        self,
        shot_id: int,
        shot_title: str,
        shot_prompt: str,
        frame_type: str,
        aspect_ratio: str = "16:9",
    ) -> str: ...


class VideoProvider(Protocol):
    def generate_video(
        self,
        shot_id: int,
        shot_title: str,
        shot_prompt: str,
        aspect_ratio: str = "16:9",
        **kwargs,
    ) -> str: ...


class VoiceProvider(Protocol):
    def generate_narration(self, text: str, voice_profile: str, shot_id: int) -> str: ...
