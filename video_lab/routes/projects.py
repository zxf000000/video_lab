"""Project, shot, character, and scene API routes."""
from __future__ import annotations

from .. import repository, services
from ..jobs import submit_project_task
from ..pipeline import start_pipeline, start_rewrite_pipeline, start_from_stage
from . import (
    register, respond_json, parse_json,
    serialize_project_summary, serialize_project_detail,
    serialize_shot, serialize_task, serialize_character,
    serialize_scene, serialize_version,
)


# ── Projects ──────────────────────────────────────────────────────

@register("GET", r"/api/projects")
def list_projects(environ, start_response):
    projects = [serialize_project_summary(p) for p in repository.list_projects()]
    return respond_json(start_response, {"projects": projects})


@register("GET", r"/api/projects/deleted")
def list_deleted(environ, start_response):
    projects = [serialize_project_summary(p) for p in repository.list_deleted_projects()]
    return respond_json(start_response, {"projects": projects})


@register("POST", r"/api/projects")
def create_project(environ, start_response):
    payload = parse_json(environ)
    title = str(payload.get("title", "")).strip()
    story_prompt = str(payload.get("story_prompt", "")).strip()
    if not title:
        return respond_json(start_response, {"error": "title is required"}, status="400 Bad Request")
    if not story_prompt:
        return respond_json(start_response, {"error": "story_prompt is required"}, status="400 Bad Request")
    target_duration = int(payload.get("target_duration", 30) or 30)
    if target_duration < 5 or target_duration > 120:
        return respond_json(start_response, {"error": "target_duration must be between 5 and 120"}, status="400 Bad Request")
    style = str(payload.get("style", "cinematic"))
    aspect_ratio = str(payload.get("aspect_ratio", "16:9"))
    original_story = str(payload.get("original_story", "")).strip()
    rewrite_direction = str(payload.get("rewrite_direction", "")).strip()
    project_id = services.create_project_row(
        title=title, prompt=story_prompt, style=style,
        aspect_ratio=aspect_ratio, target_duration=target_duration,
    )
    if rewrite_direction:
        services.rewrite_story_for_project(project_id, original_story=original_story, rewrite_direction=rewrite_direction)
        start_rewrite_pipeline(project_id)
    else:
        start_pipeline(project_id)
    project = repository.get_project(project_id)
    return respond_json(start_response, {"project": serialize_project_summary(project)}, status="201 Created")


@register("GET", r"/api/projects/(?P<project_id>\d+)")
def get_project(environ, start_response, project_id: str):
    pid = int(project_id)
    project = repository.get_project(pid)
    if not project:
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    return respond_json(start_response, {"project": serialize_project_detail(pid)})


@register("DELETE", r"/api/projects/(?P<project_id>\d+)")
def delete_project(environ, start_response, project_id: str):
    services.delete_project(int(project_id))
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/projects/(?P<project_id>\d+)/restore")
def restore_project(environ, start_response, project_id: str):
    services.restore_project(int(project_id))
    return respond_json(start_response, {"ok": True})


@register("DELETE", r"/api/projects/(?P<project_id>\d+)/permanent")
def permanent_delete(environ, start_response, project_id: str):
    services.permanent_delete_project(int(project_id))
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/projects/(?P<project_id>\d+)/regenerate")
def regenerate(environ, start_response, project_id: str):
    pid = int(project_id)
    if not repository.get_project(pid):
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    payload = parse_json(environ)
    keep_story = bool(payload.get("keep_story", False))
    if keep_story:
        task_id = start_from_stage(pid, "generate_screenplay")
    else:
        task_id = start_pipeline(pid)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


# ── Story ─────────────────────────────────────────────────────────

@register("POST", r"/api/projects/(?P<project_id>\d+)/story")
def generate_story(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_story")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("PUT", r"/api/projects/(?P<project_id>\d+)/story")
def update_story(environ, start_response, project_id: str):
    payload = parse_json(environ)
    services.update_story(int(project_id), str(payload.get("content", "")))
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


@register("GET", r"/api/projects/(?P<project_id>\d+)/story-versions")
def list_story_versions(environ, start_response, project_id: str):
    versions = repository.list_story_versions(int(project_id))
    return respond_json(start_response, {"versions": [serialize_version(v) for v in versions]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/story-versions/(?P<version_id>\d+)/restore")
def restore_story_version(environ, start_response, project_id: str, version_id: str):
    services.restore_story_version(int(project_id), int(version_id))
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


# ── Screenplay ────────────────────────────────────────────────────

@register("POST", r"/api/projects/(?P<project_id>\d+)/screenplay")
def generate_screenplay(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_screenplay")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("PUT", r"/api/projects/(?P<project_id>\d+)/screenplay")
def update_screenplay(environ, start_response, project_id: str):
    payload = parse_json(environ)
    cn = str(payload.get("content", ""))
    en = str(payload.get("content_en", ""))
    services.update_screenplay(int(project_id), cn, en)
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


@register("GET", r"/api/projects/(?P<project_id>\d+)/screenplay-versions")
def list_screenplay_versions(environ, start_response, project_id: str):
    versions = repository.list_screenplay_versions(int(project_id))
    return respond_json(start_response, {"versions": [serialize_version(v) for v in versions]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/screenplay-versions/(?P<version_id>\d+)/restore")
def restore_screenplay_version(environ, start_response, project_id: str, version_id: str):
    services.restore_screenplay_version(int(project_id), int(version_id))
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


# ── Beats ─────────────────────────────────────────────────────────

@register("POST", r"/api/projects/(?P<project_id>\d+)/beats")
def generate_beats(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_beats")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("PUT", r"/api/projects/(?P<project_id>\d+)/beats")
def update_beats(environ, start_response, project_id: str):
    payload = parse_json(environ)
    cn = str(payload.get("content", ""))
    en = str(payload.get("content_en", ""))
    services.update_beats(int(project_id), cn, en)
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


@register("GET", r"/api/projects/(?P<project_id>\d+)/beats-versions")
def list_beats_versions(environ, start_response, project_id: str):
    versions = repository.list_beats_versions(int(project_id))
    return respond_json(start_response, {"versions": [serialize_version(v) for v in versions]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/beats-versions/(?P<version_id>\d+)/restore")
def restore_beats_version(environ, start_response, project_id: str, version_id: str):
    services.restore_beats_version(int(project_id), int(version_id))
    return respond_json(start_response, {"project": serialize_project_summary(repository.get_project(int(project_id)))})


# ── Partial Regeneration ──────────────────────────────────────────

@register("POST", r"/api/projects/(?P<project_id>\d+)/regenerate-from")
def regenerate_from_stage(environ, start_response, project_id: str):
    pid = int(project_id)
    if not repository.get_project(pid):
        return respond_json(start_response, {"error": "Project not found"}, status="404 Not Found")
    payload = parse_json(environ)
    from_stage = str(payload.get("from_stage", "story"))
    valid_stages = {"story", "screenplay", "beats", "characters", "shots"}
    if from_stage not in valid_stages:
        return respond_json(start_response, {"error": f"from_stage must be one of {valid_stages}"}, status="400 Bad Request")
    # Map route stage names to pipeline stage names
    stage_map = {
        "story": "generate_story",
        "screenplay": "generate_screenplay",
        "beats": "generate_beats",
        "characters": "generate_characters",
        "shots": "split_shots",
    }
    task_id = start_from_stage(pid, stage_map[from_stage])
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


# ── Shots ─────────────────────────────────────────────────────────

@register("POST", r"/api/projects/(?P<project_id>\d+)/shots")
def split_shots(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "split_shots")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("POST", r"/api/projects/(?P<project_id>\d+)/shots/add")
def add_shot(environ, start_response, project_id: str):
    payload = parse_json(environ)
    shot_id = services.add_shot(int(project_id), payload)
    return respond_json(start_response, {"shot_id": shot_id}, status="201 Created")


@register("PUT", r"/api/projects/(?P<project_id>\d+)/shots/reorder")
def reorder_shots(environ, start_response, project_id: str):
    payload = parse_json(environ)
    services.reorder_shots(int(project_id), payload.get("shot_ids", []))
    return respond_json(start_response, {"ok": True})


@register("GET", r"/api/shots/(?P<shot_id>\d+)")
def get_shot(environ, start_response, shot_id: str):
    shot = repository.get_shot(int(shot_id))
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    return respond_json(start_response, {"shot": serialize_shot(shot)})


@register("DELETE", r"/api/shots/(?P<shot_id>\d+)")
def delete_shot(environ, start_response, shot_id: str):
    services.delete_shot(int(shot_id))
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/shots/(?P<shot_id>\d+)/prompt")
def update_shot_prompt(environ, start_response, shot_id: str):
    sid = int(shot_id)
    shot = repository.get_shot(sid)
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    payload = parse_json(environ)
    services.update_shot_prompts(sid, {
        "shot_prompt": str(payload.get("shot_prompt", shot.get("shot_prompt", ""))),
        "start_frame_prompt": str(payload.get("start_frame_prompt", shot.get("start_frame_prompt", ""))),
        "end_frame_prompt": str(payload.get("end_frame_prompt", shot.get("end_frame_prompt", ""))),
        "video_prompt": str(payload.get("video_prompt", shot.get("video_prompt", ""))),
    })
    return respond_json(start_response, {"shot": serialize_shot(repository.get_shot(sid))})


@register("PUT", r"/api/shots/(?P<shot_id>\d+)/duration")
def update_shot_duration(environ, start_response, shot_id: str):
    sid = int(shot_id)
    shot = repository.get_shot(sid)
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    payload = parse_json(environ)
    repository.update_shot_duration(sid, int(payload.get("duration_seconds", 5)))
    return respond_json(start_response, {"shot": serialize_shot(repository.get_shot(sid))})


@register("POST", r"/api/shots/(?P<shot_id>\d+)/frames")
def generate_shot_frames(environ, start_response, shot_id: str):
    sid = int(shot_id)
    shot = repository.get_shot(sid)
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    task_id = submit_project_task(int(shot["project_id"]), "generate_shot_frames", sid)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("POST", r"/api/shots/(?P<shot_id>\d+)/frames/(?P<frame_type>start|end)")
def generate_single_frame(environ, start_response, shot_id: str, frame_type: str):
    sid = int(shot_id)
    shot = repository.get_shot(sid)
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    task_id = submit_project_task(int(shot["project_id"]), "generate_single_frame", sid, frame_type=frame_type)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("POST", r"/api/shots/(?P<shot_id>\d+)/video")
def generate_shot_video(environ, start_response, shot_id: str):
    sid = int(shot_id)
    shot = repository.get_shot(sid)
    if not shot:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")
    task_id = submit_project_task(int(shot["project_id"]), "generate_shot_video", sid)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("POST", r"/api/projects/(?P<project_id>\d+)/generate-all-frames")
def generate_all_frames(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_all_frames")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("POST", r"/api/projects/(?P<project_id>\d+)/generate-all-videos")
def generate_all_videos(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_all_videos")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


# ── Characters ────────────────────────────────────────────────────

@register("GET", r"/api/projects/(?P<project_id>\d+)/characters")
def list_characters(environ, start_response, project_id: str):
    chars = repository.list_project_characters(int(project_id))
    return respond_json(start_response, {"characters": [serialize_character(c) for c in chars]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/characters")
def create_character(environ, start_response, project_id: str):
    payload = parse_json(environ)
    char_id = repository.create_character(int(project_id), payload)
    return respond_json(start_response, {"character": serialize_character(repository.get_character(char_id))}, status="201 Created")


@register("POST", r"/api/projects/(?P<project_id>\d+)/characters/generate")
def generate_characters(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_characters")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("PUT", r"/api/characters/(?P<char_id>\d+)")
def update_character(environ, start_response, char_id: str):
    payload = parse_json(environ)
    repository.update_character(int(char_id), payload)
    return respond_json(start_response, {"character": serialize_character(repository.get_character(int(char_id)))})


@register("DELETE", r"/api/characters/(?P<char_id>\d+)")
def delete_character(environ, start_response, char_id: str):
    repository.delete_character(int(char_id))
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/characters/(?P<char_id>\d+)/lock")
def lock_character(environ, start_response, char_id: str):
    payload = parse_json(environ)
    repository.lock_character(int(char_id), payload.get("locked", True))
    return respond_json(start_response, {"character": serialize_character(repository.get_character(int(char_id)))})


@register("POST", r"/api/characters/(?P<char_id>\d+)/image")
def generate_character_image(environ, start_response, char_id: str):
    cid = int(char_id)
    char = repository.get_character(cid)
    if not char:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    task_id = submit_project_task(char["project_id"], "generate_character_image", char_id=cid)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


# ── Scenes ────────────────────────────────────────────────────────

@register("GET", r"/api/projects/(?P<project_id>\d+)/scenes")
def list_scenes(environ, start_response, project_id: str):
    scenes = repository.list_project_scenes(int(project_id))
    return respond_json(start_response, {"scenes": [serialize_scene(s) for s in scenes]})


@register("POST", r"/api/projects/(?P<project_id>\d+)/scenes")
def create_scene(environ, start_response, project_id: str):
    payload = parse_json(environ)
    scene_id = repository.create_scene(int(project_id), payload)
    return respond_json(start_response, {"scene": serialize_scene(repository.get_scene(scene_id))}, status="201 Created")


@register("POST", r"/api/projects/(?P<project_id>\d+)/scenes/generate")
def generate_scenes(environ, start_response, project_id: str):
    task_id = submit_project_task(int(project_id), "generate_scenes")
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")


@register("PUT", r"/api/scenes/(?P<scene_id>\d+)")
def update_scene(environ, start_response, scene_id: str):
    payload = parse_json(environ)
    repository.update_scene(int(scene_id), payload)
    return respond_json(start_response, {"scene": serialize_scene(repository.get_scene(int(scene_id)))})


@register("DELETE", r"/api/scenes/(?P<scene_id>\d+)")
def delete_scene(environ, start_response, scene_id: str):
    repository.delete_scene(int(scene_id))
    return respond_json(start_response, {"ok": True})


@register("POST", r"/api/scenes/(?P<scene_id>\d+)/image")
def generate_scene_image(environ, start_response, scene_id: str):
    sid = int(scene_id)
    scene = repository.get_scene(sid)
    if not scene:
        return respond_json(start_response, {"error": "Scene not found"}, status="404 Not Found")
    task_id = submit_project_task(scene["project_id"], "generate_scene_image", scene_id=sid)
    return respond_json(start_response, {"task": serialize_task(repository.get_task(task_id))}, status="202 Accepted")
