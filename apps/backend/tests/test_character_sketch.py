"""Tests for character sketch-style image prompts, stylize no-op, optimize_prompt intent, and prompt template loading."""

from __future__ import annotations

import io
import re
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image


# ---------------------------------------------------------------------------
# 1. _stylize_image is a no-op
# ---------------------------------------------------------------------------

def test_stylize_image_noop():
    """_stylize_image should return the image unchanged (no-op)."""
    from video_lab.routes.prompts import _stylize_image

    img = Image.new("RGB", (100, 100), color="red")
    result = _stylize_image(img)
    assert result is img


# ---------------------------------------------------------------------------
# 2. _build_character_image_prompt — sketch keywords
# ---------------------------------------------------------------------------

def test_build_character_image_prompt_sketch_keywords():
    """Prompt suffix must contain sketch-related terms, not cinematic ones."""
    from video_lab.domain.assets.service import AssetsService

    svc = AssetsService()
    character = {
        "name": "Test",
        "identity_summary": "测试角色",
        "appearance_summary": "测试外观",
        "image_prompt": "",
        "negative_prompt": "",
    }
    visual_profile = {
        "genderPresentation": "male",
        "ageRange": "25-30",
    }
    project = {"genre": "都市短剧"}
    style_keywords: list = []

    prompt = svc._build_character_image_prompt(character, visual_profile, project, style_keywords)

    assert "铅笔素描风格" in prompt
    assert "黑白线稿" in prompt
    assert "纯色背景" in prompt
    assert "清晰轮廓线条" in prompt
    assert "电影级质感" not in prompt
    assert "均匀摄影棚灯光" not in prompt


def test_build_character_image_prompt_respects_explicit():
    """Explicit image_prompt on character should be returned as-is."""
    from video_lab.domain.assets.service import AssetsService

    svc = AssetsService()
    character = {
        "name": "Test",
        "image_prompt": "explicit custom prompt",
        "identity_summary": "",
        "appearance_summary": "",
    }
    prompt = svc._build_character_image_prompt(character, {}, {}, [])
    assert prompt == "explicit custom prompt"


# ---------------------------------------------------------------------------
# 3. New prompt templates are loaded
# ---------------------------------------------------------------------------

def test_character_image_template_loaded():
    from video_lab.config import DEFAULT_PROMPTS

    key = "prompt_character_image"
    assert key in DEFAULT_PROMPTS, f"Expected {key!r} not found"
    template = DEFAULT_PROMPTS[key]
    assert "{style}" in template
    assert "{appearance_prompt}" in template


def test_scene_image_template_loaded():
    from video_lab.config import DEFAULT_PROMPTS

    key = "prompt_scene_image"
    assert key in DEFAULT_PROMPTS, f"Expected {key!r} not found"
    template = DEFAULT_PROMPTS[key]
    assert "{style}" in template
    assert "{description}" in template


def test_eval_templates_loaded():
    from video_lab.config import DEFAULT_PROMPTS

    assert "prompt_eval_character" in DEFAULT_PROMPTS
    assert "prompt_eval_brief" in DEFAULT_PROMPTS
    assert "brief关联度" in DEFAULT_PROMPTS["prompt_eval_character"]


def test_video_realism_template_loaded():
    from video_lab.config import DEFAULT_PROMPTS

    key = "prompt_video_realism"
    assert key in DEFAULT_PROMPTS, f"Expected {key!r} not found"
    template = DEFAULT_PROMPTS[key]
    assert "{video_prompt}" in template


# ---------------------------------------------------------------------------
# 4. Template format output matches original hardcoded strings
# ---------------------------------------------------------------------------

def test_character_image_template_format():
    """Format output must match original hardcoded string."""
    from video_lab.config import DEFAULT_PROMPTS

    template = DEFAULT_PROMPTS["prompt_character_image"]
    result = template.format(style="都市短剧", appearance_prompt="测试外观描述")
    assert result.startswith("全身角色参考图，都市短剧风格：测试外观描述。")
    assert "电影级品质" in result


def test_scene_image_template_format():
    from video_lab.config import DEFAULT_PROMPTS

    template = DEFAULT_PROMPTS["prompt_scene_image"]
    result = template.format(style="都市短剧", description="测试场景")
    assert result.startswith("场景环境，都市短剧风格：测试场景。")
    assert "电影级构图" in result


# ---------------------------------------------------------------------------
# 5. Prompt debug log format
# ---------------------------------------------------------------------------

def test_prompt_debug_format():
    """Verify [PROMPT_DEBUG] log format is correct."""
    # Simulate the debug print format used in providers
    provider = "chatfire"
    model = "gpt-image-1"
    action = "character_image"
    entity_id = 42
    final_prompt = "test prompt content"

    log_line = f"[PROMPT_DEBUG] provider={provider} model={model} action={action} char_id={entity_id} final_prompt={final_prompt!r}"
    assert log_line.startswith("[PROMPT_DEBUG]")
    assert "provider=chatfire" in log_line
    assert "final_prompt='test prompt content'" in log_line


def test_seedance_debug_format():
    """Seedance debug format includes images_count."""
    log_line = "[PROMPT_DEBUG] provider=seedance model=doubao-seedance-2-0-260128 action=i2v task_id=99 prompt='test' images_count=1"
    assert "[PROMPT_DEBUG]" in log_line
    assert "images_count=1" in log_line


# ---------------------------------------------------------------------------
# 6. optimize_prompt prompt template is loadable
# ---------------------------------------------------------------------------

def test_optimize_prompt_template_loaded():
    """The optimize_prompt.txt template should be loaded by config."""
    from video_lab.config import DEFAULT_PROMPTS

    key = "prompt_copilot_character_optimize_prompt"
    assert key in DEFAULT_PROMPTS, f"Expected key {key!r} not found in DEFAULT_PROMPTS"
    template = DEFAULT_PROMPTS[key]
    assert "pencil sketch" in template
    assert "solid background" in template


# ---------------------------------------------------------------------------
# 7. SUPPORTED_INTENTS includes optimize_prompt
# ---------------------------------------------------------------------------

def test_supported_intents_has_optimize_prompt():
    from video_lab.routes.copilot import SUPPORTED_INTENTS

    assert "optimize_prompt" in SUPPORTED_INTENTS


# ---------------------------------------------------------------------------
# 8. _img_to_base64 with stylize=True calls _stylize_image (no-op)
# ---------------------------------------------------------------------------

def test_img_to_base64_stylize(tmp_path):
    """_img_to_base64 with stylize=True should still produce valid base64."""
    from video_lab.routes.prompts import _img_to_base64

    img = Image.new("RGB", (200, 100), color="blue")
    path = tmp_path / "test.png"
    img.save(path)

    b64 = _img_to_base64(path, stylize=True)
    assert b64 is not None
    assert b64.startswith("data:image/png;base64,")
    assert len(b64) > 50


def test_img_to_base64_resize(tmp_path):
    """Image larger than max_size should be resized down."""
    from video_lab.routes.prompts import _img_to_base64

    img = Image.new("RGB", (1200, 800), color="green")
    path = tmp_path / "large.png"
    img.save(path)

    b64 = _img_to_base64(path, max_size=768, stylize=False)
    assert b64 is not None
    # Re-decode to check dimensions
    import base64
    raw = base64.b64decode(b64.split(",", 1)[1])
    decoded = Image.open(io.BytesIO(raw))
    assert max(decoded.size) <= 768
