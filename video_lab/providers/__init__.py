from __future__ import annotations

from typing import Any

from ..config import AppConfig, load_kling_config, load_prompts
from .chatfire import ChatfireProvider
from .voice import NoOpProvider


def build_providers(config: AppConfig) -> dict[str, Any]:
    """Build provider set based on config. Always use ChatfireProvider."""
    prompts = load_prompts()
    chatfire = ChatfireProvider(config, prompts)
    kling_cfg = load_kling_config()
    kling = None
    if kling_cfg.kling_access_key:
        from .kling import KlingProvider
        kling = KlingProvider(kling_cfg)
    return {
        "text": chatfire,
        "image": chatfire,
        "video": chatfire,
        "voice": NoOpProvider(),
        "kling": kling,
    }
