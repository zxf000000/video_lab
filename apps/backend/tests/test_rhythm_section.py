"""Tests for build_rhythm_section utility."""
from __future__ import annotations

from video_lab.routes import build_rhythm_section


def test_build_rhythm_section_empty():
    """Empty or invalid rhythm_level returns empty string."""
    assert build_rhythm_section("") == ""
    assert build_rhythm_section("nonexistent") == ""
    assert build_rhythm_section("normal") == ""


def test_build_rhythm_section_fast_shot_stage():
    """fast level returns shot design stage text."""
    result = build_rhythm_section("fast", stage="shot")
    assert "快节奏" in result
    assert "1500-4000ms" in result
    assert "6-12" in result


def test_build_rhythm_section_ultra_fast_shot_stage():
    """ultra_fast level returns shot design stage text."""
    result = build_rhythm_section("ultra_fast", stage="shot")
    assert "极快节奏" in result
    assert "1000-3000ms" in result
    assert "8-15" in result
    assert "瞬间变脸" in result


def test_build_rhythm_section_frenzy_shot_stage():
    """frenzy level returns shot design stage text."""
    result = build_rhythm_section("frenzy", stage="shot")
    assert "癫狂节奏" in result
    assert "800-2000ms" in result
    assert "10-20" in result
    assert "残影甩镜" in result


def test_build_rhythm_section_fast_prompt_stage():
    """fast level returns prompt generation stage text."""
    result = build_rhythm_section("fast", stage="prompt")
    assert "快节奏" in result
    assert "4-5 秒" in result
    assert "2-3 个动作" in result
    assert "quick cuts" in result


def test_build_rhythm_section_ultra_fast_prompt_stage():
    """ultra_fast level returns prompt generation stage text."""
    result = build_rhythm_section("ultra_fast", stage="prompt")
    assert "极快节奏" in result
    assert "3-4 个动作" in result
    assert "whip pan" in result
    assert "motion blur" in result


def test_build_rhythm_section_frenzy_prompt_stage():
    """frenzy level returns prompt generation stage text."""
    result = build_rhythm_section("frenzy", stage="prompt")
    assert "癫狂节奏" in result
    assert "4-5 个以上" in result
    assert "残影拖影" in result
    assert "glitch effect" in result
    assert "0.5 秒" in result


def test_default_stage_is_shot():
    """Default stage is 'shot'."""
    result = build_rhythm_section("fast")
    assert "镜头预估时长" in result
    assert "quick cuts" not in result
