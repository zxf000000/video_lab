"""Route registry and shared WSGI utilities."""
from __future__ import annotations

import json
import mimetypes
import re
import threading
from pathlib import Path
from typing import Callable

# ── Thread-local request context ──────────────────────────────────
_request_ctx = threading.local()


# ── CORS ──────────────────────────────────────────────────────────
_CORS_ORIGINS: set[str] | None = None


def _get_cors_origins() -> set[str]:
    global _CORS_ORIGINS
    if _CORS_ORIGINS is None:
        import os
        raw = os.environ.get("VIDEO_LAB_CORS_ORIGINS", "http://localhost:3000")
        _CORS_ORIGINS = {o.strip() for o in raw.split(",") if o.strip()}
    return _CORS_ORIGINS


def cors_headers() -> list[tuple[str, str]]:
    allowed = _get_cors_origins()
    origin = getattr(_request_ctx, "origin", "")
    cors_origin = origin if origin in allowed else ""
    return [
        ("Access-Control-Allow-Origin", cors_origin),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type"),
    ]


# ── Response helpers ──────────────────────────────────────────────
def respond_json(start_response, payload: dict[str, object], status: str = "200 OK"):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = cors_headers() + [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    start_response(status, headers)
    return [body]


def respond_empty(start_response, status: str = "204 No Content"):
    start_response(status, cors_headers())
    return [b""]


def respond_not_found(start_response):
    return respond_json(start_response, {"error": "Not found"}, status="404 Not Found")


def serve_file(start_response, path: Path):
    if not path.exists() or not path.is_file():
        return respond_not_found(start_response)
    content_type, _ = mimetypes.guess_type(str(path))
    body = path.read_bytes()
    start_response(
        "200 OK",
        cors_headers() + [
            ("Content-Type", content_type or "application/octet-stream"),
            ("Content-Length", str(len(body))),
        ],
    )
    return [body]


def parse_json(environ) -> dict[str, object]:
    try:
        size = int(environ.get("CONTENT_LENGTH", "0") or "0")
    except ValueError:
        size = 0
    raw = environ["wsgi.input"].read(size).decode("utf-8").strip()
    if not raw:
        raise ValueError("Request body is empty")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}")


def parse_qs_param(environ, key: str, default: str = "") -> str:
    from urllib.parse import parse_qs
    qs = parse_qs(environ.get("QUERY_STRING", ""))
    return qs.get(key, [default])[0]


# ── Serializers ───────────────────────────────────────────────────
def serialize_project_summary(project: dict[str, object] | None) -> dict[str, object]:
    if not project:
        return {}
    if "name" in project:
        return {
            "id": project["id"],
            "name": project["name"],
            "genre": project.get("genre", ""),
            "target_platform": project.get("target_platform", ""),
            "episode_count_planned": project.get("episode_count_planned", 0),
            "current_stage": project.get("current_stage", "draft"),
            "status": project.get("status", "draft"),
            "created_at": project["created_at"],
            "updated_at": project["updated_at"],
        }
    return {
        "id": project["id"],
        "title": project["title"],
        "story_prompt": project["story_prompt"],
        "style": project["style"],
        "aspect_ratio": project["aspect_ratio"],
        "target_duration": project["target_duration"],
        "status": project["status"],
        "story_content": project["story_content"],
        "screenplay_content": project.get("screenplay_content", ""),
        "screenplay_content_en": project.get("screenplay_content_en", ""),
        "beats_content": project.get("beats_content", ""),
        "beats_content_en": project.get("beats_content_en", ""),
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
    }


def serialize_shot(shot: dict[str, object] | None) -> dict[str, object]:
    if not shot:
        return {}
    if "visual_goal" in shot:
        return {
            "id": shot["id"],
            "episode_id": shot["episode_id"],
            "scene_block": shot.get("scene_block", ""),
            "shot_no": shot.get("shot_no", 0),
            "visual_goal": shot.get("visual_goal", ""),
            "character_ids": shot.get("character_ids", "[]"),
            "scene_preset_id": shot.get("scene_preset_id"),
            "shot_size": shot.get("shot_size", ""),
            "camera_angle": shot.get("camera_angle", ""),
            "composition": shot.get("composition", ""),
            "action_description": shot.get("action_description", ""),
            "facial_emotion": shot.get("facial_emotion", ""),
            "camera_motion": shot.get("camera_motion", ""),
            "dialogue_excerpt": shot.get("dialogue_excerpt", ""),
            "estimated_duration_ms": shot.get("estimated_duration_ms", 0),
            "status": shot.get("status", "draft"),
            "sort_order": shot.get("sort_order", 0),
            "created_at": shot["created_at"],
            "updated_at": shot["updated_at"],
        }
    return {
        "id": shot["id"],
        "project_id": shot["project_id"],
        "episode_id": shot.get("episode_id"),
        "order_index": shot["order_index"],
        "shot_title": shot["shot_title"],
        "shot_description": shot["shot_description"],
        "shot_prompt": shot["shot_prompt"],
        "duration_seconds": shot["duration_seconds"],
        "status": shot["status"],
        "character_action": shot.get("character_action", ""),
        "scene_description": shot.get("scene_description", ""),
        "camera_movement": shot.get("camera_movement", ""),
        "emotion_keywords": shot.get("emotion_keywords", ""),
        "narration_text": shot.get("narration_text", ""),
        "start_frame_prompt": shot.get("start_frame_prompt", ""),
        "end_frame_prompt": shot.get("end_frame_prompt", ""),
        "video_prompt": shot.get("video_prompt", ""),
        "character_ids": shot.get("character_ids", "[]"),
        "scene_id": shot.get("scene_id"),
        "start_frame_url": f"/assets/{shot['start_frame_path']}" if shot.get("start_frame_path") else None,
        "end_frame_url": f"/assets/{shot['end_frame_path']}" if shot.get("end_frame_path") else None,
        "video_url": f"/assets/{shot['video_path']}" if shot.get("video_path") else None,
        "created_at": shot["created_at"],
        "updated_at": shot["updated_at"],
    }


def serialize_task(task: dict[str, object] | None) -> dict[str, object]:
    if not task:
        return {}
    if "input_payload" in task:
        params = {}
        output_assets = []
        raw_params = task.get("input_payload")
        raw_output_assets = task.get("output_assets")
        if raw_params:
            try:
                params = json.loads(raw_params) if isinstance(raw_params, str) else raw_params
            except (ValueError, TypeError):
                params = {}
        if raw_output_assets:
            try:
                output_assets = json.loads(raw_output_assets) if isinstance(raw_output_assets, str) else raw_output_assets
            except (ValueError, TypeError):
                output_assets = []
        return {
            "id": task["id"],
            "project_id": task["project_id"],
            "episode_id": task.get("episode_id"),
            "shot_id": task.get("shot_id"),
            "shot_prompt_id": task.get("shot_prompt_id"),
            "provider": task.get("provider", ""),
            "model_name": task.get("model_name", ""),
            "status": task.get("status", "queued"),
            "input_payload": params,
            "output_assets": output_assets,
            "retry_count": task.get("retry_count", 0),
            "error_message": task.get("error_message", ""),
            "cost_amount": task.get("cost_amount", 0),
            "duration_ms": task.get("duration_ms", 0),
            "submitted_at": task.get("submitted_at"),
            "finished_at": task.get("finished_at"),
        }
    params = {}
    raw_params = task.get("params")
    if raw_params:
        try:
            params = json.loads(raw_params) if isinstance(raw_params, str) else raw_params
        except (ValueError, TypeError):
            params = {}
    return {
        "id": task["id"],
        "project_id": task["project_id"],
        "shot_id": task["shot_id"],
        "task_type": task["task_type"],
        "status": task["status"],
        "error_message": task["error_message"],
        "params": params,
        "created_at": task["created_at"],
        "updated_at": task["updated_at"],
    }


def serialize_character(char: dict[str, object] | None) -> dict[str, object]:
    if not char:
        return {}
    if "appearance_summary" in char:
        return {
            "id": char["id"],
            "project_id": char["project_id"],
            "name": char["name"],
            "role_type": char.get("role_type", ""),
            "identity_summary": char.get("identity_summary", ""),
            "appearance_summary": char.get("appearance_summary", ""),
            "personality_tags": char.get("personality_tags", "[]"),
            "speech_style": char.get("speech_style", ""),
            "visual_profile": char.get("visual_profile", "{}"),
            "image_prompt": char.get("image_prompt", ""),
            "negative_prompt": char.get("negative_prompt", ""),
            "voice_profile": char.get("voice_profile", "{}"),
            "outfit_presets": char.get("outfit_presets", "[]"),
            "negative_constraints": char.get("negative_constraints", ""),
            "reference_asset_ids": char.get("reference_asset_ids", "[]"),
            "status": char.get("status", "draft"),
            "version_no": char.get("version_no", 1),
            "image_path": char.get("image_path", ""),
            "created_at": char["created_at"],
            "updated_at": char["updated_at"],
        }
    return {
        "id": char["id"],
        "project_id": char["project_id"],
        "name": char["name"],
        "appearance_prompt": char["appearance_prompt"],
        "personality_tags": char["personality_tags"],
        "voice_profile": char["voice_profile"],
        "image_path": char.get("image_path", ""),
        "locked": bool(char["locked"]),
        "created_at": char["created_at"],
        "updated_at": char["updated_at"],
    }


def serialize_scene(scene: dict[str, object] | None) -> dict[str, object]:
    if not scene:
        return {}
    if "space_description" in scene:
        return {
            "id": scene["id"],
            "project_id": scene["project_id"],
            "name": scene["name"],
            "scene_type": scene.get("scene_type", ""),
            "space_description": scene.get("space_description", ""),
            "lighting_style": scene.get("lighting_style", ""),
            "time_of_day": scene.get("time_of_day", ""),
            "weather": scene.get("weather", ""),
            "prop_list": scene.get("prop_list", "[]"),
            "negative_constraints": scene.get("negative_constraints", ""),
            "image_prompt": scene.get("image_prompt", ""),
            "negative_prompt": scene.get("negative_prompt", ""),
            "reference_asset_ids": scene.get("reference_asset_ids", "[]"),
            "variants": scene.get("variants", "[]"),
            "episode_id": scene.get("episode_id"),
            "status": scene.get("status", "draft"),
            "version_no": scene.get("version_no", 1),
            "created_at": scene["created_at"],
            "updated_at": scene["updated_at"],
        }
    return {
        "id": scene["id"],
        "project_id": scene["project_id"],
        "name": scene["name"],
        "description": scene["description"],
        "reference_image_path": scene["reference_image_path"],
        "locked": bool(scene["locked"]),
        "created_at": scene["created_at"],
        "updated_at": scene["updated_at"],
    }


def serialize_episode(episode: dict[str, object] | None) -> dict[str, object]:
    if not episode:
        return {}
    if "episode_no" in episode:
        return {
            "id": episode["id"],
            "project_id": episode["project_id"],
            "episode_no": episode["episode_no"],
            "title": episode["title"],
            "summary": episode.get("summary", ""),
            "goal": episode.get("goal", ""),
            "core_conflict": episode.get("core_conflict", ""),
            "opening_hook": episode.get("opening_hook", ""),
            "climax": episode.get("climax", ""),
            "ending_hook": episode.get("ending_hook", ""),
            "status": episode.get("status", "draft"),
            "sort_order": episode.get("sort_order", 0),
            "created_at": episode["created_at"],
            "updated_at": episode["updated_at"],
        }
    return {
        "id": episode["id"],
        "project_id": episode["project_id"],
        "episode_number": episode["episode_number"],
        "title": episode["title"],
        "outline_summary": episode.get("outline_summary", ""),
        "screenplay_content": episode.get("screenplay_content", ""),
        "screenplay_content_en": episode.get("screenplay_content_en", ""),
        "status": episode.get("status", "draft"),
        "created_at": episode["created_at"],
        "updated_at": episode["updated_at"],
    }


def serialize_version(version: dict[str, object] | None) -> dict[str, object]:
    if not version:
        return {}
    return {
        "id": version["id"],
        "project_id": version.get("project_id"),
        "episode_id": version.get("episode_id"),
        "content": version["content"],
        "content_en": version.get("content_en", ""),
        "version": version["version"],
        "created_at": version["created_at"],
    }


def serialize_prompt(prompt: dict[str, object] | None) -> dict[str, object]:
    if not prompt:
        return {}
    return {
        "id": prompt["id"],
        "shot_id": prompt["shot_id"],
        "version_no": prompt.get("version_no", 1),
        "prompt_text": prompt.get("prompt_text", ""),
        "first_frame_prompt": prompt.get("first_frame_prompt", ""),
        "first_frame_negative_prompt": prompt.get("first_frame_negative_prompt", ""),
        "video_prompt": prompt.get("video_prompt", ""),
        "video_negative_prompt": prompt.get("video_negative_prompt", ""),
        "negative_prompt": prompt.get("negative_prompt", ""),
        "model_params": prompt.get("model_params", "{}"),
        "reference_asset_ids": prompt.get("reference_asset_ids", "[]"),
        "status": prompt.get("status", "draft"),
        "is_active": bool(prompt.get("is_active", 0)),
        "created_at": prompt.get("created_at"),
        "updated_at": prompt.get("updated_at"),
    }


def serialize_review_issue(issue: dict[str, object] | None) -> dict[str, object]:
    if not issue:
        return {}
    return {
        "id": issue["id"],
        "project_id": issue["project_id"],
        "episode_id": issue.get("episode_id"),
        "shot_id": issue.get("shot_id"),
        "generation_task_id": issue.get("generation_task_id"),
        "issue_type": issue.get("issue_type", ""),
        "severity": issue.get("severity", "medium"),
        "description": issue.get("description", ""),
        "rework_target_type": issue.get("rework_target_type", "shot_prompt"),
        "resolution_status": issue.get("resolution_status", "open"),
        "created_at": issue.get("created_at"),
        "resolved_at": issue.get("resolved_at"),
    }


def serialize_episode_export(export: dict[str, object] | None) -> dict[str, object]:
    if not export:
        return {}
    return {
        "id": export["id"],
        "episode_id": export["episode_id"],
        "version_no": export.get("version_no", 1),
        "selected_task_ids": export.get("selected_task_ids", "[]"),
        "timeline_data": export.get("timeline_data", "{}"),
        "subtitle_data": export.get("subtitle_data", "{}"),
        "audio_data": export.get("audio_data", "{}"),
        "preview_url": export.get("preview_url", ""),
        "export_url": export.get("export_url", ""),
        "status": export.get("status", "draft"),
        "created_at": export.get("created_at"),
        "updated_at": export.get("updated_at"),
    }


def serialize_project_detail(project_id: int) -> dict[str, object]:
    from .. import repository
    repository.fail_stale_tasks()
    project = repository.get_project(project_id)
    shots = repository.list_project_shots(project_id)
    tasks = repository.list_project_tasks(project_id)
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    episodes = repository.list_project_episodes(project_id)
    return {
        **serialize_project_summary(project),
        "shots": [serialize_shot(s) for s in shots],
        "tasks": [serialize_task(t) for t in tasks],
        "characters": [serialize_character(c) for c in characters],
        "scenes": [serialize_scene(s) for s in scenes],
        "episodes": [serialize_episode(e) for e in episodes],
    }


# ── Route registry ────────────────────────────────────────────────
# Each module adds entries: (method, pattern_regex) → handler
# Pattern uses named groups (?P<name>...) for path params.
RouteKey = tuple[str, re.Pattern]
RouteHandler = Callable[..., list[bytes]]
ROUTES: dict[RouteKey, RouteHandler] = {}


def register(method: str, pattern: str):
    """Decorator to register a route handler."""
    compiled = re.compile(f"^{pattern}$")
    def decorator(fn: RouteHandler) -> RouteHandler:
        ROUTES[(method, compiled)] = fn
        return fn
    return decorator


def dispatch(environ, start_response) -> list[bytes] | None:
    """Try to match the request to a registered route. Returns None if no match."""
    method = environ.get("REQUEST_METHOD", "GET")
    path = environ.get("PATH_INFO", "/")

    for (route_method, pattern), handler in ROUTES.items():
        if route_method != method:
            continue
        m = pattern.match(path)
        if m:
            kwargs = m.groupdict()
            return handler(environ, start_response, **kwargs)
    return None


# ── Import all route modules to populate ROUTES ──────────────────
def register_all_routes():
    from . import (
        projects,
        copilot,
        prompts,
        generation_tasks,
        review_export,
        config as cfg,
        seedance,
        kling,
        generate,
        assets,
    )
    # Each module's @register decorators have already populated ROUTES
