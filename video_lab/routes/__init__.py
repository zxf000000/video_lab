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
    return {
        "id": project["id"],
        "title": project["title"],
        "story_prompt": project["story_prompt"],
        "style": project["style"],
        "aspect_ratio": project["aspect_ratio"],
        "target_duration": project["target_duration"],
        "status": project["status"],
        "story_content": project["story_content"],
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
    }


def serialize_shot(shot: dict[str, object] | None) -> dict[str, object]:
    if not shot:
        return {}
    return {
        "id": shot["id"],
        "project_id": shot["project_id"],
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


def serialize_version(version: dict[str, object] | None) -> dict[str, object]:
    if not version:
        return {}
    return {
        "id": version["id"],
        "project_id": version["project_id"],
        "content": version["content"],
        "version": version["version"],
        "created_at": version["created_at"],
    }


def serialize_project_detail(project_id: int) -> dict[str, object]:
    from .. import repository
    repository.fail_stale_tasks()
    project = repository.get_project(project_id)
    shots = repository.list_project_shots(project_id)
    tasks = repository.list_project_tasks(project_id)
    characters = repository.list_project_characters(project_id)
    scenes = repository.list_project_scenes(project_id)
    return {
        **serialize_project_summary(project),
        "shots": [serialize_shot(s) for s in shots],
        "tasks": [serialize_task(t) for t in tasks],
        "characters": [serialize_character(c) for c in characters],
        "scenes": [serialize_scene(s) for s in scenes],
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
    from . import projects, config as cfg, seedance, kling, generate, assets
    # Each module's @register decorators have already populated ROUTES
