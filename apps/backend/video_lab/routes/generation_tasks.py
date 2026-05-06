from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

from ..config import load_config, load_prompts
from ..domain.assets import AssetsService
from ..domain.generation import GenerationService
from ..domain.shots import ShotsService
from ..providers.chatfire import ChatfireProvider
from . import parse_json, register, respond_json, serialize_task
from .copilot import (
    _compile_messages,
    _extract_scene_proposal,
    _extract_screenplay_proposal,
    _extract_shot_proposal,
    _normalize_messages,
)

generation_service = GenerationService()
shots_service = ShotsService()
_copilot_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="copilot-gen")


def _stream_llm_response(module_type: str, context: dict, messages: list[dict], project_id: int, entity_id: int) -> str:
    """Call LLM with copilot prompts and return the full response text."""
    prompts = load_prompts()
    config = load_config()
    provider = ChatfireProvider(config, prompts)

    system_prompt = prompts.get(f"prompt_copilot_{module_type}_system", "")
    user_template = prompts.get(f"prompt_copilot_{module_type}_generate", "")
    if not system_prompt or not user_template:
        raise RuntimeError(f"Copilot prompts for '{module_type}' are not configured")

    user_goal = messages[-1]["content"] if messages else "请生成"
    compiled_messages = _compile_messages(
        messages,
        user_template=user_template,
        context=context,
        user_goal=user_goal,
        project_id=project_id,
        entity_id=entity_id,
    )

    full_text = ""
    for delta in provider.chat_stream(compiled_messages, system_prompt):
        full_text += delta
    return full_text


def _make_task_payload(project_id: int, episode_id: int, module_type: str, context: dict) -> dict:
    return {
        "project_id": project_id,
        "episode_id": episode_id,
        "shot_id": None,
        "shot_prompt_id": None,
        "provider": "copilot",
        "model_name": module_type,
        "status": "queued",
        "input_payload": json.dumps({"context": context}, ensure_ascii=False),
        "output_assets": "[]",
        "retry_count": 0,
        "error_message": "",
        "cost_amount": 0,
        "duration_ms": 0,
    }


# ── Screenplay executor ──────────────────────────────────────────

def _run_generate_screenplay(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict]) -> None:
    gen_svc = GenerationService()
    shots_svc = ShotsService()
    try:
        gen_svc.repository.update_task(task_id, {"status": "running"})
        full_text = _stream_llm_response("screenplay", context, messages, project_id, episode_id)
        proposal = _extract_screenplay_proposal(full_text)
        if not proposal:
            raise RuntimeError("Unable to parse screenplay proposal from LLM response")
        content = proposal.get("content", "")
        scenes = proposal.get("scenes", [])
        shots_svc.update_episode(episode_id, {
            "screenplay_content": content,
            "screenplay_scenes": json.dumps(scenes, ensure_ascii=False),
        })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"type": "screenplay", "scenes": proposal.get("scenes", [])}], ensure_ascii=False),
        })
    except Exception as exc:
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


# ── Scene executor ───────────────────────────────────────────────

def _run_generate_scenes(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict]) -> None:
    gen_svc = GenerationService()
    assets_svc = AssetsService()
    try:
        gen_svc.repository.update_task(task_id, {"status": "running"})
        full_text = _stream_llm_response("scene", context, messages, project_id, episode_id)
        proposal = _extract_scene_proposal(full_text)
        if not proposal or not proposal.get("scenes"):
            raise RuntimeError("Unable to parse scene proposal from LLM response")
        created_ids: list[int] = []
        for scene in proposal["scenes"]:
            sid = assets_svc.upsert_scene_preset(project_id, {**scene, "episode_id": episode_id})
            created_ids.append(sid)
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"type": "scenes", "scene_ids": created_ids}], ensure_ascii=False),
        })
    except Exception as exc:
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


# ── Shot executor ────────────────────────────────────────────────

def _run_generate_shots(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict]) -> None:
    gen_svc = GenerationService()
    shots_svc = ShotsService()
    try:
        gen_svc.repository.update_task(task_id, {"status": "running"})
        # Inject episode screenplay data so the LLM sees the full narrative arc
        episode = shots_svc.repository.get_episode(episode_id)
        if episode:
            if episode.get("screenplay_content"):
                context.setdefault("screenplay_content", episode["screenplay_content"])
            if episode.get("screenplay_scenes"):
                scenes = episode["screenplay_scenes"]
                if isinstance(scenes, str):
                    try:
                        scenes = json.loads(scenes)
                    except (json.JSONDecodeError, TypeError):
                        scenes = []
                context.setdefault("screenplay_scenes", scenes)
        full_text = _stream_llm_response("shot", context, messages, project_id, episode_id)
        proposal = _extract_shot_proposal(full_text)
        if not proposal or not proposal.get("shots"):
            raise RuntimeError("Unable to parse shot proposal from LLM response")
        shots_data = proposal["shots"]
        shots_svc.delete_shots_by_episode(episode_id)
        from ..domain.shots.batch_repository import BatchRepository
        batch_repo = BatchRepository()
        batch_id = batch_repo.create_batch(episode_id, task_id, len(shots_data))
        created_ids: list[int] = []
        for shot in shots_data:
            shot["batch_id"] = batch_id
            sid = shots_svc.create_shot(episode_id, shot)
            created_ids.append(sid)
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"type": "shots", "shot_ids": created_ids, "batch_id": batch_id}], ensure_ascii=False),
        })
    except Exception as exc:
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


# ── Endpoints ────────────────────────────────────────────────────

def _submit_copilot_task(environ, start_response, episode_id: str, module_type: str) -> list[bytes]:
    payload = parse_json(environ)
    episode_id_int = int(episode_id)
    episode = shots_service.repository.get_episode(episode_id_int)
    if not episode:
        return respond_json(start_response, {"error": "Episode not found"}, status="404 Not Found")

    context = payload.get("context")
    if not isinstance(context, dict):
        return respond_json(start_response, {"error": "context is required"}, status="400 Bad Request")

    try:
        messages = _normalize_messages(payload.get("messages"))
    except ValueError as exc:
        return respond_json(start_response, {"error": str(exc)}, status="400 Bad Request")

    project_id = int(episode["project_id"])
    task_payload = _make_task_payload(project_id, episode_id_int, module_type, context)
    task_id = generation_service.repository.create_task(task_payload)

    executors = {
        "screenplay": _run_generate_screenplay,
        "scene": _run_generate_scenes,
        "shot": _run_generate_shots,
    }
    executor_fn = executors[module_type]
    _copilot_executor.submit(executor_fn, task_id, episode_id_int, project_id, context, messages)

    task = generation_service.get_task(task_id)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/generate-screenplay")
def submit_screenplay_generation(environ, start_response, episode_id: str):
    return _submit_copilot_task(environ, start_response, episode_id, "screenplay")


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/generate-scenes")
def submit_scene_generation(environ, start_response, episode_id: str):
    return _submit_copilot_task(environ, start_response, episode_id, "scene")


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/generate-shots")
def submit_shot_generation(environ, start_response, episode_id: str):
    return _submit_copilot_task(environ, start_response, episode_id, "shot")


# ── Existing endpoints ───────────────────────────────────────────

@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate")
def submit_shot_frame_generation(environ, start_response, shot_id: str):
    payload = parse_json(environ)
    try:
        task_id = generation_service.submit_shot_generation(int(shot_id), payload)
        task = generation_service.get_task(task_id)
    except ValueError as exc:
        message = str(exc)
        status = "404 Not Found" if "not found" in message else "400 Bad Request"
        return respond_json(start_response, {"error": message}, status=status)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/generate-batch")
def submit_episode_batch(environ, start_response, episode_id: str):
    payload = parse_json(environ)
    task_ids = generation_service.submit_episode_batch(int(episode_id), payload)
    tasks = [serialize_task(generation_service.get_task(task_id)) for task_id in task_ids]
    return respond_json(start_response, {"tasks": tasks}, status="202 Accepted")


@register("GET", r"/api/tasks/(?P<task_id>\d+)")
def get_task(environ, start_response, task_id: str):
    try:
        task = generation_service.get_task(int(task_id))
    except ValueError:
        return respond_json(start_response, {"error": "Task not found"}, status="404 Not Found")
    return respond_json(start_response, {"task": serialize_task(task)})


@register("POST", r"/api/tasks/(?P<task_id>\d+)/retry")
def retry_task(environ, start_response, task_id: str):
    try:
        generation_service.retry_task(int(task_id))
        task = generation_service.get_task(int(task_id))
    except ValueError:
        return respond_json(start_response, {"error": "Task not found"}, status="404 Not Found")
    return respond_json(start_response, {"task": serialize_task(task)})
