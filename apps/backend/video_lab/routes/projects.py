"""Base resource routes for the new AI short drama schema."""
from __future__ import annotations

from ..domain.assets import AssetsService
from ..domain.generation import GenerationService
from ..domain.projects import ProjectsService
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
    try:
        character = assets_service.generate_character_image(int(char_id))
    except ValueError:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"character": serialize_character(character)})


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
    return respond_json(start_response, {"shots": [serialize_shot(s) for s in shots]})


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
