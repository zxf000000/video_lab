"""Base resource routes for the new AI short drama schema."""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

from ..domain.assets import AssetsService
from ..domain.generation import GenerationService
from ..domain.projects import ProjectsService
from ..domain.prompts import PromptsService
from ..domain.shots import ShotsService
from . import (
    parse_json,
    register,
    respond_json,
    serialize_character,
    serialize_episode,
    serialize_project_summary,
    serialize_scene,
    serialize_shot,
    serialize_task,
)

projects_service = ProjectsService()
assets_service = AssetsService()
shots_service = ShotsService()
generation_service = GenerationService()
_character_image_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="character-image-gen")


def _run_generate_character_image(task_id: int, char_id: int) -> None:
    assets_svc = AssetsService()
    gen_svc = GenerationService()
    try:
        character = assets_svc.generate_character_image(char_id)
        assets_svc.repository.update_character(char_id, {"image_status": "succeeded"})
        output_url = character.get("image_path", "") if character else ""
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"url": output_url, "type": "image"}], ensure_ascii=False) if output_url else "[]",
        })
    except Exception as exc:
        assets_svc.repository.update_character(char_id, {"image_status": "failed"})
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc)[:500],
        })


@register("GET", r"/api/projects")
def list_projects(environ, start_response):
    projects = [serialize_project_summary(p) for p in projects_service.list_projects()]
    return respond_json(start_response, {"projects": projects})


@register("POST", r"/api/projects")
def create_project(environ, start_response):
    payload = parse_json(environ)
    project_id = projects_service.create_project(payload)
    project = projects_service.get_overview(project_id)["project"]
    return respond_json(start_response, {"project": serialize_project_summary(project)}, status="201 Created")


@register("GET", r"/api/projects/(?P<project_id>\d+)")
def get_project(environ, start_response, project_id: str):
    pid = int(project_id)
    try:
        overview = projects_service.get_overview(pid)
    except ValueError:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    project = overview["project"]
    brief = overview["brief"]
    episodes = [serialize_episode(e) for e in shots_service.list_episodes(pid)]
    characters = [serialize_character(c) for c in assets_service.list_characters(pid)]
    scenes = [serialize_scene(s) for s in assets_service.list_scene_presets(pid)]
    tasks = [serialize_task(t) for t in generation_service.list_tasks_for_project(pid)]
    return respond_json(
        start_response,
        {
            "project": {
                **serialize_project_summary(project),
                "brief": brief,
                "episodes": episodes,
                "characters": characters,
                "scenes": scenes,
                "tasks": tasks,
            }
        },
    )


@register("PUT", r"/api/projects/(?P<project_id>\d+)")
def update_project(environ, start_response, project_id: str):
    payload = parse_json(environ)
    try:
        projects_service.update_project(int(project_id), payload)
        project = projects_service.get_overview(int(project_id))["project"]
    except ValueError:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    return respond_json(start_response, {"project": serialize_project_summary(project)})


@register("DELETE", r"/api/projects/(?P<project_id>\d+)")
def delete_project(environ, start_response, project_id: str):
    try:
        projects_service.delete_project(int(project_id))
    except ValueError:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    return respond_json(start_response, {"ok": True})


@register("GET", r"/api/projects/(?P<project_id>\d+)/brief")
def get_project_brief(environ, start_response, project_id: str):
    try:
        brief = projects_service.get_brief(int(project_id))
    except ValueError:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    return respond_json(start_response, {"brief": brief})


@register("PUT", r"/api/projects/(?P<project_id>\d+)/brief")
def upsert_project_brief(environ, start_response, project_id: str):
    payload = parse_json(environ)
    try:
        projects_service.upsert_brief(int(project_id), payload)
        brief = projects_service.get_brief(int(project_id))
    except ValueError:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    return respond_json(start_response, {"brief": brief})


@register("GET", r"/api/projects/(?P<project_id>\d+)/characters")
def list_characters(environ, start_response, project_id: str):
    chars = assets_service.list_characters(int(project_id))
    return respond_json(start_response, {"characters": [serialize_character(c) for c in chars]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/characters")
def create_character(environ, start_response, project_id: str):
    payload = parse_json(environ)
    char_id = assets_service.upsert_character(int(project_id), payload)
    return respond_json(start_response, {"character": serialize_character(assets_service.repository.get_character(char_id))}, status="201 Created")


@register("PUT", r"/api/characters/(?P<char_id>\d+)")
def update_character(environ, start_response, char_id: str):
    payload = parse_json(environ)
    existing = assets_service.repository.get_character(int(char_id))
    if not existing:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    assets_service.upsert_character(int(existing["project_id"]), {"id": int(char_id), **payload})
    return respond_json(start_response, {"character": serialize_character(assets_service.repository.get_character(int(char_id)))})


@register("DELETE", r"/api/characters/(?P<char_id>\d+)")
def delete_character(environ, start_response, char_id: str):
    try:
        assets_service.delete_character(int(char_id))
    except ValueError:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/characters/(?P<char_id>\d+)/generate-image")
def generate_character_image(environ, start_response, char_id: str):
    char_id_int = int(char_id)
    character = assets_service.repository.get_character(char_id_int)
    if not character:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    try:
        assets_service.repository.update_character(char_id_int, {"image_status": "generating"})
        task_payload = {
            "project_id": int(character["project_id"]),
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "kling",
            "model_name": "kling-v2-1",
            "status": "queued",
            "input_payload": "{}",
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        }
        task_id = generation_service.repository.create_task(task_payload)
        generation_service.repository.update_task(task_id, {"status": "running"})
        _character_image_executor.submit(_run_generate_character_image, task_id, char_id_int)
        task = generation_service.get_task(task_id)
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("GET", r"/api/projects/(?P<project_id>\d+)/scenes")
def list_scenes(environ, start_response, project_id: str):
    scenes = assets_service.list_scene_presets(int(project_id))
    return respond_json(start_response, {"scenes": [serialize_scene(s) for s in scenes]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/scenes")
def create_scene(environ, start_response, project_id: str):
    payload = parse_json(environ)
    scene_id = assets_service.upsert_scene_preset(int(project_id), payload)
    return respond_json(start_response, {"scene": serialize_scene(assets_service.repository.get_scene_preset(scene_id))}, status="201 Created")


@register("PUT", r"/api/scenes/(?P<scene_id>\d+)")
def update_scene(environ, start_response, scene_id: str):
    payload = parse_json(environ)
    existing = assets_service.repository.get_scene_preset(int(scene_id))
    if not existing:
        return respond_json(start_response, {"error": "Scene not found"}, status="404 Not Found")
    assets_service.upsert_scene_preset(int(existing["project_id"]), {"id": int(scene_id), **payload})
    return respond_json(start_response, {"scene": serialize_scene(assets_service.repository.get_scene_preset(int(scene_id)))})


@register("DELETE", r"/api/scenes/(?P<scene_id>\d+)")
def delete_scene(environ, start_response, scene_id: str):
    try:
        assets_service.delete_scene_preset(int(scene_id))
    except ValueError:
        return respond_json(start_response, {"error": "Scene not found"}, status="404 Not Found")
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/scenes/(?P<scene_id>\d+)/generate-image")
def generate_scene_image(environ, start_response, scene_id: str):
    try:
        scene = assets_service.generate_scene_image(int(scene_id))
    except ValueError:
        return respond_json(start_response, {"error": "Scene not found"}, status="404 Not Found")
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"scene": serialize_scene(scene)})


@register("GET", r"/api/projects/(?P<project_id>\d+)/episodes")
def list_episodes(environ, start_response, project_id: str):
    episodes = shots_service.list_episodes(int(project_id))
    return respond_json(start_response, {"episodes": [serialize_episode(e) for e in episodes]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/episodes")
def create_episode(environ, start_response, project_id: str):
    payload = parse_json(environ)
    existing = shots_service.list_episodes(int(project_id))
    if payload.get("episode_no") in (None, "") and payload.get("episode_number") in (None, ""):
        payload = {**payload, "episode_no": len(existing) + 1}
    episode_id = shots_service.create_episode(int(project_id), payload)
    return respond_json(start_response, {"episode": serialize_episode(shots_service.get_episode(episode_id))}, status="201 Created")


@register("PUT", r"/api/episodes/(?P<episode_id>\d+)")
def update_episode(environ, start_response, episode_id: str):
    payload = parse_json(environ)
    try:
        shots_service.update_episode(int(episode_id), payload)
        episode = shots_service.get_episode(int(episode_id))
    except ValueError:
        return respond_json(start_response, {"error": "Episode not found"}, status="404 Not Found")
    return respond_json(start_response, {"episode": serialize_episode(episode)})


@register("DELETE", r"/api/episodes/(?P<episode_id>\d+)")
def delete_episode(environ, start_response, episode_id: str):
    try:
        shots_service.delete_episode(int(episode_id))
    except ValueError:
        return respond_json(start_response, {"error": "Episode not found"}, status="404 Not Found")
    return respond_json(start_response, {"ok": True})


@register("GET", r"/api/episodes/(?P<episode_id>\d+)/shots")
def list_episode_shots(environ, start_response, episode_id: str):
    try:
        shots_service.get_episode(int(episode_id))
    except ValueError:
        return respond_json(start_response, {"error": "Episode not found"}, status="404 Not Found")
    shots = shots_service.list_shots(int(episode_id))
    prompts_service = PromptsService()
    shot_ids = [int(s["id"]) for s in shots]
    active_prompts = prompts_service.repository.get_active_prompts_for_shots(shot_ids)
    result = []
    for s in shots:
        serialized = serialize_shot(s)
        prompt = active_prompts.get(int(s["id"]))
        serialized["firstFrameUrl"] = prompt.get("first_frame_url", "") if prompt else ""
        serialized["videoUrl"] = prompt.get("video_url", "") if prompt else ""
        result.append(serialized)
    return respond_json(start_response, {"shots": result})


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/shots")
def add_episode_shot(environ, start_response, episode_id: str):
    payload = parse_json(environ)
    try:
        shot_id = shots_service.create_shot(int(episode_id), payload)
        shot = shots_service.get_shot(shot_id)
    except ValueError:
        return respond_json(start_response, {"error": "Episode not found"}, status="404 Not Found")
    return respond_json(start_response, {"shot": serialize_shot(shot)}, status="201 Created")


@register("GET", r"/api/shots/(?P<shot_id>\d+)")
def get_shot(environ, start_response, shot_id: str):
    try:
        shot = shots_service.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    return respond_json(start_response, {"shot": serialize_shot(shot)})


@register("PUT", r"/api/shots/(?P<shot_id>\d+)")
def update_shot(environ, start_response, shot_id: str):
    payload = parse_json(environ)
    try:
        shots_service.update_shot(int(shot_id), payload)
        shot = shots_service.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    return respond_json(start_response, {"shot": serialize_shot(shot)})


@register("DELETE", r"/api/shots/(?P<shot_id>\d+)")
def delete_shot(environ, start_response, shot_id: str):
    try:
        shots_service.delete_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    return respond_json(start_response, {"ok": True})


# ── Shot batches (version history) ──────────────────────────────

@register("GET", r"/api/episodes/(?P<episode_id>\d+)/shot-batches")
def list_shot_batches(environ, start_response, episode_id: str):
    from ..domain.shots.batch_repository import BatchRepository
    repo = BatchRepository()
    batches = repo.list_batches(int(episode_id))
    return respond_json(start_response, {"batches": batches})


@register("GET", r"/api/shot-batches/(?P<batch_id>\d+)/shots")
def list_batch_shots(environ, start_response, batch_id: str):
    shots_repo = shots_service.repository
    conn = shots_repo.get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM shots WHERE batch_id = ? ORDER BY sort_order ASC, shot_no ASC, id ASC",
            (int(batch_id),),
        ).fetchall()
        from ..domain.common import rows_to_dicts
        shot_dicts = rows_to_dicts(rows)
    finally:
        conn.close()
    return respond_json(start_response, {"shots": [serialize_shot(s) for s in shot_dicts]})
