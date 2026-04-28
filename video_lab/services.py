from __future__ import annotations

import base64
import json
import logging
import re
import threading
from pathlib import Path

import requests as _req

from . import repository
from .config import load_config
from .db import ASSETS_DIR
from .providers import build_providers

logger = logging.getLogger(__name__)

_config = None
_providers = None
_provider_lock = threading.Lock()


def _get_providers():
    global _providers, _config
    cfg = load_config()
    # Fast path: no lock if already loaded and config unchanged
    if _providers is not None and cfg == _config:
        return _providers
    with _provider_lock:
        # Double-check after acquiring lock
        if _providers is None or cfg != _config:
            _config = cfg
            _providers = build_providers(cfg)
        return _providers


def reload_providers():
    """Force provider reload after config change."""
    global _providers, _config
    with _provider_lock:
        _config = load_config()
        _providers = build_providers(_config)


def _text():
    return _get_providers()["text"]


def _image():
    return _get_providers()["image"]


def _video():
    return _get_providers()["video"]


def _kling():
    return _get_providers().get("kling")


def create_project_row(title: str, prompt: str, style: str, aspect_ratio: str, target_duration: int) -> int:
    return repository.create_project(
        repository.ProjectInput(
            title=title.strip() or "未命名项目",
            story_prompt=prompt.strip(),
            style=style.strip() or "cinematic",
            aspect_ratio=aspect_ratio.strip() or "16:9",
            target_duration=target_duration,
        )
    )


def create_project_and_story(title: str, prompt: str, style: str, aspect_ratio: str, target_duration: int) -> int:
    project_id = create_project_row(title, prompt, style, aspect_ratio, target_duration)
    generate_story(project_id)
    generate_characters(project_id)
    generate_scenes(project_id)
    split_shots(project_id)
    return project_id


def rewrite_story_for_project(project_id: int, original_story: str, rewrite_direction: str) -> None:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_status(project_id, "generating_story")
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    story = _text().rewrite_story(
        original_story=original_story,
        rewrite_direction=rewrite_direction,
        style=project["style"],
        characters=characters,
        scenes=scenes,
    )
    # 分析改写后剧本的实际段落数，根据段落数反推建议时长（快剪风格）
    paragraphs = [p.strip() for p in story.split("\n\n") if p.strip()]
    paragraph_count = len(paragraphs)
    # 时长映射：每段约 3 秒（快剪节奏，最小时长 5 秒）
    suggested_duration = max(5, 3 * paragraph_count)
    # 根据段落数量更新项目的 target_duration
    if suggested_duration != int(project["target_duration"]):
        repository.update_project_duration(project_id, suggested_duration)
    repository.update_project_story(project_id, story, "story_ready")


def create_project_by_rewrite(title: str, prompt: str, original_story: str, rewrite_direction: str, style: str, aspect_ratio: str, target_duration: int) -> int:
    project_id = create_project_row(title, prompt, style, aspect_ratio, target_duration)
    rewrite_story_for_project(project_id, original_story, rewrite_direction)
    generate_characters(project_id)
    generate_scenes(project_id)
    split_shots(project_id)
    return project_id


def generate_story(project_id: int) -> None:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_status(project_id, "generating_story")
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    story = _text().generate_story(
        title=project["title"],
        prompt=project["story_prompt"],
        style=project["style"],
        duration_seconds=int(project["target_duration"]),
        characters=characters,
        scenes=scenes,
    )
    repository.update_project_story(project_id, story, "story_ready")


def expand_story_beats(project_id: int) -> str:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    story = project["story_content"] or project["story_prompt"]
    beats = _text().expand_story_beats(
        story=story,
        style=project["style"],
        duration_seconds=int(project["target_duration"]),
        characters=characters,
        scenes=scenes,
    )
    return beats.strip() or story


def expand_story_screenplay(project_id: int) -> str:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    story = project["story_content"] or project["story_prompt"]
    screenplay = _text().expand_story_screenplay(
        story=story,
        style=project["style"],
        duration_seconds=int(project["target_duration"]),
        characters=characters,
        scenes=scenes,
    )
    return screenplay.strip() or story


def split_shots(project_id: int) -> None:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_status(project_id, "splitting_shots")
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    story_input = project["story_content"] or project["story_prompt"]
    try:
        screenplay_text = expand_story_screenplay(project_id)
    except Exception as exc:
        logger.warning("expand_story_screenplay failed for project %s, falling back to raw story: %s", project_id, exc)
        screenplay_text = story_input
    try:
        beat_story = _text().expand_story_beats(
            story=screenplay_text,
            style=project["style"],
            duration_seconds=int(project["target_duration"]),
            characters=characters,
            scenes=scenes,
        ).strip() or screenplay_text
    except Exception as exc:
        logger.warning("expand_story_beats failed for project %s, falling back to screenplay: %s", project_id, exc)
        beat_story = screenplay_text
    shots = _text().split_story_into_shots(
        beat_story,
        int(project["target_duration"]),
        characters=characters,
        scenes=scenes,
    )
    repository.replace_project_shots(project_id, shots, characters, scenes)
    repository.update_project_status(project_id, "shots_ready")


def update_story(project_id: int, content: str) -> None:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_story(project_id, content.strip(), project["status"])


def restore_story_version(project_id: int, version_id: int) -> None:
    version = repository.get_story_version(version_id)
    if not version or version["project_id"] != project_id:
        raise ValueError("Story version not found")
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_story(project_id, version["content"], project["status"])


def _normalize_name(name: str) -> str:
    """去掉括号后缀，如 '张三（魔化）' → '张三'"""
    return re.sub(r'[（(].*?[）)]', '', name).strip()


def _get_shot_context(shot: dict) -> tuple[str, str, list[str], str, list[str]]:
    """Get character appearances, scene description, and reference image paths.

    Returns (char_appearances, scene_description, char_image_paths, scene_image_path, char_names).
    Uses character_ids and scene_id from the shot record for precise lookup.
    """
    char_appearances: list[str] = []
    char_image_paths: list[str] = []
    char_names: list[str] = []
    scene_description = ""
    scene_image_path = ""

    # Get characters from character_ids
    raw_char_ids = shot.get("character_ids", "[]")
    if isinstance(raw_char_ids, str):
        try:
            char_ids = json.loads(raw_char_ids)
        except (json.JSONDecodeError, TypeError):
            char_ids = []
    else:
        char_ids = raw_char_ids

    for cid in (char_ids if isinstance(char_ids, list) else []):
        c = repository.get_character(int(cid))
        if c:
            char_appearances.append(c.get("appearance_prompt", ""))
            char_image_paths.append(c.get("image_path") or "")
            char_names.append(c.get("name", ""))

    # Get scene from scene_id
    scene_id = shot.get("scene_id")
    if scene_id:
        sc = repository.get_scene(int(scene_id))
        if sc:
            scene_description = sc.get("description", "")
            scene_image_path = sc.get("reference_image_path") or ""

    return char_appearances, scene_description, char_image_paths, scene_image_path, char_names


def _get_project_aspect_ratio_for_shot(shot: dict) -> str:
    project_id = shot.get("project_id")
    if not project_id:
        return "16:9"
    project = repository.get_project(int(project_id))
    if not project:
        return "16:9"
    return project.get("aspect_ratio") or "16:9"


def generate_shot_frames(shot_id: int) -> None:
    shot = repository.get_shot(shot_id)
    if not shot:
        raise ValueError("Shot not found")
    char_appearances, scene_description, char_image_paths, scene_image_path, char_names = _get_shot_context(shot)
    char_appearance = ". ".join(char_appearances)
    aspect_ratio = _get_project_aspect_ratio_for_shot(shot)
    start_frame = _image().generate_frame(
        shot_id=shot_id,
        shot_title=shot["shot_title"],
        shot_prompt=shot["shot_prompt"],
        frame_type="start",
        character_appearance=char_appearance,
        scene_description=scene_description,
        character_image_paths=char_image_paths,
        character_names=char_names,
        scene_image_path=scene_image_path,
        start_frame_prompt=shot.get("start_frame_prompt", ""),
        end_frame_prompt=shot.get("end_frame_prompt", ""),
        aspect_ratio=aspect_ratio,
    )
    end_frame = _image().generate_frame(
        shot_id=shot_id,
        shot_title=shot["shot_title"],
        shot_prompt=shot["shot_prompt"],
        frame_type="end",
        character_appearance=char_appearance,
        scene_description=scene_description,
        character_image_paths=char_image_paths,
        character_names=char_names,
        scene_image_path=scene_image_path,
        start_frame_prompt=shot.get("start_frame_prompt", ""),
        end_frame_prompt=shot.get("end_frame_prompt", ""),
        aspect_ratio=aspect_ratio,
    )
    repository.update_shot_frames(shot_id, start_frame, end_frame, "frames_ready")


def generate_single_frame(shot_id: int, frame_type: str) -> None:
    if frame_type not in ("start", "end"):
        raise ValueError("frame_type must be 'start' or 'end'")
    shot = repository.get_shot(shot_id)
    if not shot:
        raise ValueError("Shot not found")
    char_appearances, scene_description, char_image_paths, scene_image_path, char_names = _get_shot_context(shot)
    char_appearance = ". ".join(char_appearances)
    aspect_ratio = _get_project_aspect_ratio_for_shot(shot)
    frame_path = _image().generate_frame(
        shot_id=shot_id,
        shot_title=shot["shot_title"],
        shot_prompt=shot["shot_prompt"],
        frame_type=frame_type,
        character_appearance=char_appearance,
        scene_description=scene_description,
        character_image_paths=char_image_paths,
        character_names=char_names,
        scene_image_path=scene_image_path,
        start_frame_prompt=shot.get("start_frame_prompt", ""),
        end_frame_prompt=shot.get("end_frame_prompt", ""),
        aspect_ratio=aspect_ratio,
    )
    repository.update_shot_single_frame(shot_id, frame_type, frame_path)
    shot = repository.get_shot(shot_id)
    if shot and shot.get("start_frame_path") and shot.get("end_frame_path"):
        repository.update_shot_status(shot_id, "frames_ready")


def generate_shot_video(shot_id: int) -> None:
    shot = repository.get_shot(shot_id)
    if not shot:
        raise ValueError("Shot not found")
    if not shot["start_frame_path"] or not shot["end_frame_path"]:
        generate_shot_frames(shot_id)
        shot = repository.get_shot(shot_id)
        if not shot:
            raise ValueError("Shot not found after frame generation")
    char_apps, scene_desc, char_imgs, scene_img, char_names = _get_shot_context(shot)
    aspect_ratio = _get_project_aspect_ratio_for_shot(shot)
    video_prompt = str(shot.get("video_prompt") or "").strip() or shot["shot_prompt"]
    video_file = _video().generate_video(
        shot_id=shot_id,
        shot_title=shot["shot_title"],
        shot_prompt=video_prompt,
        start_frame_path=shot.get("start_frame_path", ""),
        end_frame_path=shot.get("end_frame_path", ""),
        narration_text=shot.get("narration_text", ""),
        character_names=char_names,
        scene_description=scene_desc,
        character_image_paths=char_imgs,
        scene_image_path=scene_img,
        aspect_ratio=aspect_ratio,
    )
    repository.update_shot_video(shot_id, video_file, "video_ready")


def update_shot_prompt(shot_id: int, shot_prompt: str) -> None:
    update_shot_prompts(shot_id, {"shot_prompt": shot_prompt})


def update_shot_prompts(shot_id: int, prompt_fields: dict[str, str]) -> None:
    shot = repository.get_shot(shot_id)
    if not shot:
        raise ValueError("Shot not found")
    normalized_fields = {
        key: str(value).strip()
        for key, value in prompt_fields.items()
        if key in {"shot_prompt", "start_frame_prompt", "end_frame_prompt", "video_prompt"}
    }
    if not normalized_fields:
        return
    changed = any(str(shot.get(key) or "") != value for key, value in normalized_fields.items())
    if not changed:
        return
    repository.clear_shot_outputs(shot_id)
    repository.update_shot_prompts(shot_id, normalized_fields)


def add_shot(project_id: int, shot_data: dict) -> int:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    shots = repository.list_project_shots(project_id)
    max_order = max((s["order_index"] for s in shots), default=0)
    shot_data["order_index"] = max_order + 1
    return repository.create_shot(project_id, shot_data)


def delete_shot(shot_id: int) -> None:
    shot = repository.get_shot(shot_id)
    if not shot:
        raise ValueError("Shot not found")
    repository.delete_shot(shot_id)


def reorder_shots(project_id: int, shot_ids: list[int]) -> None:
    for index, shot_id in enumerate(shot_ids, start=1):
        repository.update_shot_order(shot_id, index)


def delete_project(project_id: int) -> None:
    if not repository.delete_project(project_id):
        raise ValueError("Project not found")


def restore_project(project_id: int) -> None:
    if not repository.restore_project(project_id):
        raise ValueError("Project not found or not deleted")


def permanent_delete_project(project_id: int) -> None:
    if not repository.permanent_delete_project(project_id):
        raise ValueError("Project not found")


def generate_all_shot_frames(project_id: int) -> None:
    shots = repository.list_project_shots(project_id)
    for shot in shots:
        generate_shot_frames(int(shot["id"]))


def generate_all_shot_videos(project_id: int) -> None:
    shots = repository.list_project_shots(project_id)
    for shot in shots:
        generate_shot_video(int(shot["id"]))


def generate_characters(project_id: int) -> list[dict]:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_status(project_id, "generating_characters")
    # Preserve locked characters (user-created variants etc.)
    existing = repository.list_project_characters(project_id)
    locked_chars = [c for c in existing if c["locked"]]
    repository.delete_unlocked_characters(project_id)
    characters_data = _text().generate_characters(
        story=project["story_content"] or project["story_prompt"],
        style=project["style"],
    )
    # Skip AI-extracted names that match locked character base names
    locked_base_names = {_normalize_name(c["name"]) for c in locked_chars}
    result = list(locked_chars)
    for char in characters_data:
        if _normalize_name(char["name"]) in locked_base_names:
            continue
        char_id = repository.create_character(project_id, char)
        char["id"] = char_id
        result.append(char)
    return result


def generate_scenes(project_id: int) -> list[dict]:
    project = repository.get_project(project_id)
    if not project:
        raise ValueError("Project not found")
    repository.update_project_status(project_id, "generating_scenes")
    repository.delete_project_scenes(project_id)
    scenes_data = _text().generate_scenes(
        story=project["story_content"] or project["story_prompt"],
        style=project["style"],
    )
    result = []
    for scene in scenes_data:
        scene_id = repository.create_scene(project_id, scene)
        scene["id"] = scene_id
        result.append(scene)
    return result


def generate_character_image(char_id: int) -> str:
    char = repository.get_character(char_id)
    if not char:
        raise ValueError("Character not found")
    project = repository.get_project(char["project_id"])
    kling = _kling()
    provider = kling if kling else _image()
    path = provider.generate_character_image(char_id, char["appearance_prompt"], project["style"])
    repository.update_character(char_id, {**char, "image_path": path})
    return path


def generate_scene_image(scene_id: int) -> str:
    scene = repository.get_scene(scene_id)
    if not scene:
        raise ValueError("Scene not found")
    project = repository.get_project(scene["project_id"])
    kling = _kling()
    provider = kling if kling else _image()
    path = provider.generate_scene_image(scene_id, scene["description"], project["style"])
    repository.update_scene(scene_id, {**scene, "reference_image_path": path})
    return path


def generate_quick_video(task_id: int, prompt: str, style: str = "cinematic", aspect_ratio: str = "16:9", target_duration: int = 5, image_urls: list | None = None, image_b64s: list | None = None, ref_image_urls: list | None = None, resolution: str = "720p", video_model: str = "") -> str:
    image_urls = image_urls or []
    image_b64s = image_b64s or []
    ref_image_urls = ref_image_urls or []

    repository.update_task_progress(task_id, "处理素材")

    # Save uploaded/direct images to disk (used as start/end frames)
    saved_paths = []
    for i, b64 in enumerate(image_b64s):
        fname = f"quick_{task_id}_ref_{i}.png"
        (ASSETS_DIR / fname).write_bytes(base64.b64decode(b64))
        saved_paths.append(fname)
    for i, url in enumerate(image_urls):
        fname = f"quick_{task_id}_url_{i}.png"
        resp = _req.get(url, timeout=30)
        resp.raise_for_status()
        (ASSETS_DIR / fname).write_bytes(resp.content)
        saved_paths.append(fname)

    # First image → start_frame, last image → end_frame (if 2+)
    start_frame_path = saved_paths[0] if saved_paths else ""
    end_frame_path = saved_paths[-1] if len(saved_paths) > 1 else ""

    # Save reference image URLs to disk (supports both HTTP URLs and base64 data URLs)
    ref_paths = []
    for i, url in enumerate(ref_image_urls[:4]):
        fname = f"quick_{task_id}_refimg_{i}.png"
        if url.startswith("data:"):
            # base64 data URL
            b64_part = url.split(",", 1)[1]
            (ASSETS_DIR / fname).write_bytes(base64.b64decode(b64_part))
        else:
            resp = _req.get(url, timeout=30)
            resp.raise_for_status()
            (ASSETS_DIR / fname).write_bytes(resp.content)
        ref_paths.append(str(ASSETS_DIR / fname))

    repository.update_task_progress(task_id, "提交视频生成")

    video_file = _video().generate_video(
        shot_id=task_id,  # quick video 没有真实 shot，用 task_id 作文件命名标识
        shot_title="快速生成",
        shot_prompt=prompt,
        start_frame_path=start_frame_path,
        end_frame_path=end_frame_path,
        scene_description="",
        aspect_ratio=aspect_ratio,
        duration=min(target_duration, 300),
        reference_image_paths=ref_paths,
        resolution=resolution,
        model=video_model or None,
    )

    repository.update_task_progress(task_id, "下载视频")
    return video_file
