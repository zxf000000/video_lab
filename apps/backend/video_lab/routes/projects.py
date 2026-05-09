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
_character_copilot_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="char-copilot")


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


def _run_optimize_prompt(task_id: int, char_id: int) -> None:
    from ..config import load_config, load_prompts
    from ..providers.chatfire import ChatfireProvider
    from ..routes.copilot import _extract_character_proposal, _compile_messages
    assets_svc = AssetsService()
    gen_svc = GenerationService()
    try:
        character = assets_svc.repository.get_character(char_id)
        if not character:
            raise ValueError("Character not found")
        project_id = int(character["project_id"])
        prompts = load_prompts()
        config = load_config()
        provider = ChatfireProvider(config, prompts)

        system_prompt = prompts.get("prompt_copilot_character_system", "")
        user_template = prompts.get("prompt_copilot_character_optimize_prompt", "")
        if not system_prompt or not user_template:
            raise ValueError("optimize_prompt templates not configured")

        context = {
            "generation_stage": "visual_refine",
            "current_character": {
                "character_profile": {
                    "name": character.get("name", ""),
                    "role_type": character.get("role_type", ""),
                    "species": character.get("species", ""),
                    "identity_summary": character.get("identity_summary", ""),
                    "appearance_summary": character.get("appearance_summary", ""),
                    "personality_tags": character.get("personality_tags", "[]"),
                    "speech_style": character.get("speech_style", ""),
                    "negative_constraints": character.get("negative_constraints", ""),
                },
                "image_spec": {
                    "image_prompt": character.get("image_prompt", ""),
                    "negative_prompt": character.get("negative_prompt", ""),
                },
            },
        }

        user_goal = "请优化当前角色的 image_prompt，使其更适合彩色铅笔线稿风格出图"
        compiled_messages = _compile_messages(
            [{"role": "user", "content": user_goal}],
            user_template=user_template,
            context=context,
            user_goal=user_goal,
            project_id=project_id,
            entity_id=char_id,
        )
        raw = provider._chat(system_prompt, compiled_messages[-1]["content"], timeout=300)
        proposal = _extract_character_proposal(raw)
        role = (proposal.get("roles") or [None])[0] if proposal else None
        image_spec = (role or {}).get("image_spec", {})
        image_prompt = str(image_spec.get("image_prompt", "")).strip() if image_spec else ""
        negative_prompt = str(image_spec.get("negative_prompt", "")).strip() if image_spec else ""
        if not image_prompt:
            raise ValueError("LLM 未返回优化后的 image_prompt")

        vp = assets_svc.repository.parse_json_column(character.get("visual_profile"), {})
        base_spec = vp.get("baseImageSpec") if isinstance(vp.get("baseImageSpec"), dict) else vp
        base_spec["imagePrompt"] = image_prompt
        base_spec["negativePrompt"] = negative_prompt
        if isinstance(vp.get("baseImageSpec"), dict):
            vp["baseImageSpec"] = base_spec
        assets_svc.repository.update_character(char_id, {
            "image_prompt": image_prompt,
            "negative_prompt": negative_prompt,
            "visual_profile": json.dumps(vp, ensure_ascii=False),
            "prompt_status": "succeeded",
        })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"image_prompt": image_prompt, "negative_prompt": negative_prompt}], ensure_ascii=False),
        })
    except Exception as exc:
        assets_svc.repository.update_character(char_id, {"prompt_status": "failed"})
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


def _run_generate_prompt(task_id: int, char_id: int) -> None:
    from ..config import load_config, load_prompts
    from ..providers.chatfire import ChatfireProvider
    from ..routes.copilot import _extract_character_proposal, _compile_messages
    assets_svc = AssetsService()
    gen_svc = GenerationService()
    try:
        character = assets_svc.repository.get_character(char_id)
        if not character:
            raise ValueError("Character not found")
        project_id = int(character["project_id"])
        brief = assets_svc.repository.get_project_brief(project_id) or {}
        prompts = load_prompts()
        config = load_config()
        provider = ChatfireProvider(config, prompts)

        system_prompt = prompts.get("prompt_copilot_character_system", "")
        user_template = prompts.get("prompt_copilot_character_generate", "")
        if not system_prompt or not user_template:
            raise ValueError("generate prompt templates not configured")

        existing_chars = assets_svc.repository.list_characters(project_id)
        context = {
            "generation_stage": "visual_refine",
            "current_character": {
                "character_profile": {
                    "name": character.get("name", ""),
                    "role_type": character.get("role_type", ""),
                    "species": character.get("species", ""),
                    "identity_summary": character.get("identity_summary", ""),
                    "appearance_summary": character.get("appearance_summary", ""),
                    "personality_tags": character.get("personality_tags", "[]"),
                    "speech_style": character.get("speech_style", ""),
                    "negative_constraints": character.get("negative_constraints", ""),
                },
                "image_spec": {
                    "image_prompt": character.get("image_prompt", ""),
                    "negative_prompt": character.get("negative_prompt", ""),
                },
            },
            "existing_characters": [
                {"name": c.get("name", ""), "role_type": c.get("role_type", ""), "identity_summary": c.get("identity_summary", "")}
                for c in existing_chars if c.get("id") != char_id
            ],
            "brief_summary": {
                "logline": brief.get("logline", ""),
                "world_rules": brief.get("world_rules", ""),
                "main_conflict": brief.get("main_conflict", ""),
                "relationship_summary": brief.get("relationship_summary", ""),
            },
        }

        user_goal = "请基于当前角色的完整人设（身份、外观、性格、brief背景），重新生成一个可直接出图的 image_prompt"
        compiled_messages = _compile_messages(
            [{"role": "user", "content": user_goal}],
            user_template=user_template,
            context=context,
            user_goal=user_goal,
            project_id=project_id,
            entity_id=char_id,
        )
        raw = provider._chat(system_prompt, compiled_messages[-1]["content"], timeout=300)
        proposal = _extract_character_proposal(raw)
        if proposal is None:
            print(f"[PROMPT_DEBUG] action=generate_prompt char_id={char_id} parse_failed raw={raw[:800]!r}")
        role = (proposal.get("roles") or [None])[0] if proposal else None
        image_spec = (role or {}).get("image_spec", {})
        image_prompt = str(image_spec.get("image_prompt", "")).strip() if image_spec else ""
        negative_prompt = str(image_spec.get("negative_prompt", "")).strip() if image_spec else ""
        if not image_prompt:
            raise ValueError("LLM 未返回生成的 image_prompt")

        # Also update visual_profile.baseImageSpec so frontend picks up the generated prompt
        vp = assets_svc.repository.parse_json_column(character.get("visual_profile"), {})
        base_spec = vp.get("baseImageSpec") if isinstance(vp.get("baseImageSpec"), dict) else vp
        base_spec["imagePrompt"] = image_prompt
        base_spec["negativePrompt"] = negative_prompt
        if isinstance(vp.get("baseImageSpec"), dict):
            vp["baseImageSpec"] = base_spec
        assets_svc.repository.update_character(char_id, {
            "image_prompt": image_prompt,
            "negative_prompt": negative_prompt,
            "visual_profile": json.dumps(vp, ensure_ascii=False),
            "prompt_status": "succeeded",
        })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"image_prompt": image_prompt, "negative_prompt": negative_prompt}], ensure_ascii=False),
        })
    except Exception as exc:
        assets_svc.repository.update_character(char_id, {"prompt_status": "failed"})
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


def _run_generate_anchor(task_id: int, char_id: int) -> None:
    from ..config import load_config, load_prompts
    from ..providers.chatfire import ChatfireProvider
    from ..routes.copilot import _extract_character_proposal, _compile_messages
    assets_svc = AssetsService()
    gen_svc = GenerationService()
    try:
        character = assets_svc.repository.get_character(char_id)
        if not character:
            raise ValueError("Character not found")
        project_id = int(character["project_id"])
        prompts = load_prompts()
        config = load_config()
        provider = ChatfireProvider(config, prompts)

        system_prompt = prompts.get("prompt_copilot_character_system", "")
        user_template = prompts.get("prompt_copilot_character_appearance_anchor", "")
        if not system_prompt or not user_template:
            raise ValueError("appearance_anchor templates not configured")

        context = {
            "generation_stage": "visual_refine",
            "current_character": {
                "character_profile": {
                    "name": character.get("name", ""),
                    "role_type": character.get("role_type", ""),
                    "species": character.get("species", ""),
                    "identity_summary": character.get("identity_summary", ""),
                    "appearance_summary": character.get("appearance_summary", ""),
                    "personality_tags": character.get("personality_tags", "[]"),
                    "speech_style": character.get("speech_style", ""),
                    "negative_constraints": character.get("negative_constraints", ""),
                },
                "image_spec": {
                    "image_prompt": character.get("image_prompt", ""),
                    "negative_prompt": character.get("negative_prompt", ""),
                },
            },
        }

        user_goal = "请为当前角色生成外观锚定词"
        compiled_messages = _compile_messages(
            [{"role": "user", "content": user_goal}],
            user_template=user_template,
            context=context,
            user_goal=user_goal,
            project_id=project_id,
            entity_id=char_id,
        )
        raw = provider._chat(system_prompt, compiled_messages[-1]["content"], timeout=300)
        proposal = _extract_character_proposal(raw)
        role = (proposal.get("roles") or [None])[0] if proposal else None
        appearance_anchor = str((role or {}).get("appearance_anchor", "")).strip() if proposal else ""
        if not appearance_anchor:
            raise ValueError("LLM 未返回外观锚定词")

        assets_svc.repository.update_character(char_id, {
            "appearance_prompt": appearance_anchor,
            "anchor_status": "succeeded",
        })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"appearance_anchor": appearance_anchor}], ensure_ascii=False),
        })
    except Exception as exc:
        assets_svc.repository.update_character(char_id, {"anchor_status": "failed"})
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


def _run_regenerate_character(task_id: int, char_id: int, regenerate_input: str) -> None:
    from ..config import load_config, load_prompts
    from ..providers.chatfire import ChatfireProvider
    from ..routes.copilot import _extract_character_proposal, _compile_messages
    assets_svc = AssetsService()
    gen_svc = GenerationService()
    try:
        character = assets_svc.repository.get_character(char_id)
        if not character:
            raise ValueError("Character not found")
        project_id = int(character["project_id"])
        prompts = load_prompts()
        config = load_config()
        provider = ChatfireProvider(config, prompts)

        system_prompt = prompts.get("prompt_copilot_character_system", "")
        user_template = prompts.get("prompt_copilot_character_regenerate", "")
        if not system_prompt or not user_template:
            raise ValueError("regenerate templates not configured")

        existing_chars = assets_svc.repository.list_characters(project_id)
        context = {
            "generation_stage": "visual_refine",
            "current_character": {
                "character_profile": {
                    "name": character.get("name", ""),
                    "role_type": character.get("role_type", ""),
                    "species": character.get("species", ""),
                    "identity_summary": character.get("identity_summary", ""),
                    "appearance_summary": character.get("appearance_summary", ""),
                    "personality_tags": character.get("personality_tags", "[]"),
                    "speech_style": character.get("speech_style", ""),
                    "negative_constraints": character.get("negative_constraints", ""),
                },
                "image_spec": {},
            },
            "existing_characters": [{
                "character_profile": {
                    "name": c.get("name", ""),
                    "role_type": c.get("role_type", ""),
                    "species": c.get("species", ""),
                    "identity_summary": c.get("identity_summary", ""),
                    "appearance_summary": c.get("appearance_summary", ""),
                    "personality_tags": c.get("personality_tags", "[]"),
                    "speech_style": c.get("speech_style", ""),
                },
                "image_spec": {},
            } for c in existing_chars],
        }

        compiled_messages = _compile_messages(
            [{"role": "user", "content": regenerate_input}],
            user_template=user_template,
            context=context,
            user_goal=regenerate_input,
            project_id=project_id,
            entity_id=char_id,
        )
        raw = provider._chat(system_prompt, compiled_messages[-1]["content"], timeout=300)
        proposal = _extract_character_proposal(raw)
        role = (proposal.get("roles") or [None])[0] if proposal else None
        if role:
            profile = role.get("character_profile", {})
            assets_svc.repository.update_character(char_id, {
                "name": str(profile.get("name", character.get("name", ""))),
                "role_type": str(profile.get("role_type", character.get("role_type", ""))),
                "identity_summary": str(profile.get("identity_summary", character.get("identity_summary", ""))),
                "appearance_summary": str(profile.get("appearance_summary", character.get("appearance_summary", ""))),
                "personality_tags": json.dumps([str(t) for t in profile.get("personality_tags", [])], ensure_ascii=False) if profile.get("personality_tags") else character.get("personality_tags", "[]"),
                "speech_style": str(profile.get("speech_style", character.get("speech_style", ""))),
                "regenerate_status": "succeeded",
            })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
        })
    except Exception as exc:
        assets_svc.repository.update_character(char_id, {"regenerate_status": "failed"})
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


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


@register("POST", r"/api/projects/batch-delete")
def batch_delete_projects(environ, start_response):
    payload = parse_json(environ)
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        return respond_json(start_response, {"error": "ids (array) required"}, status="400 Bad Request")
    count = projects_service.delete_projects(ids)
    return respond_json(start_response, {"ok": True, "deleted": count})


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


@register("POST", r"/api/characters/(?P<char_id>\d+)/optimize-prompt")
def optimize_character_prompt(environ, start_response, char_id: str):
    char_id_int = int(char_id)
    character = assets_service.repository.get_character(char_id_int)
    if not character:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    try:
        assets_service.repository.update_character(char_id_int, {"prompt_status": "running"})
        task_payload = {
            "project_id": int(character["project_id"]),
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "chatfire",
            "model_name": "",
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
        _character_copilot_executor.submit(_run_optimize_prompt, task_id, char_id_int)
        task = generation_service.get_task(task_id)
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/characters/(?P<char_id>\d+)/generate-prompt")
def generate_character_prompt(environ, start_response, char_id: str):
    char_id_int = int(char_id)
    character = assets_service.repository.get_character(char_id_int)
    if not character:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    try:
        assets_service.repository.update_character(char_id_int, {"prompt_status": "running"})
        task_payload = {
            "project_id": int(character["project_id"]),
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "chatfire",
            "model_name": "",
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
        _character_copilot_executor.submit(_run_generate_prompt, task_id, char_id_int)
        task = generation_service.get_task(task_id)
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/characters/(?P<char_id>\d+)/generate-anchor")
def generate_character_anchor(environ, start_response, char_id: str):
    char_id_int = int(char_id)
    character = assets_service.repository.get_character(char_id_int)
    if not character:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    try:
        assets_service.repository.update_character(char_id_int, {"anchor_status": "running"})
        task_payload = {
            "project_id": int(character["project_id"]),
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "chatfire",
            "model_name": "",
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
        _character_copilot_executor.submit(_run_generate_anchor, task_id, char_id_int)
        task = generation_service.get_task(task_id)
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/characters/(?P<char_id>\d+)/regenerate")
def regenerate_character(environ, start_response, char_id: str):
    char_id_int = int(char_id)
    character = assets_service.repository.get_character(char_id_int)
    if not character:
        return respond_json(start_response, {"error": "Character not found"}, status="404 Not Found")
    payload = parse_json(environ)
    regenerate_input = str(payload.get("input", "")).strip()
    if not regenerate_input:
        return respond_json(start_response, {"error": "input is required"}, status="400 Bad Request")
    try:
        assets_service.repository.update_character(char_id_int, {"regenerate_status": "running"})
        task_payload = {
            "project_id": int(character["project_id"]),
            "episode_id": None,
            "shot_id": None,
            "shot_prompt_id": None,
            "provider": "chatfire",
            "model_name": "",
            "status": "queued",
            "input_payload": json.dumps({"input": regenerate_input}, ensure_ascii=False),
            "output_assets": "[]",
            "retry_count": 0,
            "error_message": "",
            "cost_amount": 0,
            "duration_ms": 0,
        }
        task_id = generation_service.repository.create_task(task_payload)
        generation_service.repository.update_task(task_id, {"status": "running"})
        _character_copilot_executor.submit(_run_regenerate_character, task_id, char_id_int, regenerate_input)
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


# ── Scene override endpoints ─────────────────────────────────────

@register("GET", r"/api/scene-presets/(?P<scene_preset_id>\d+)/overrides")
def list_scene_overrides(environ, start_response, scene_preset_id: str):
    overrides = assets_service.list_overrides_for_preset(int(scene_preset_id))
    return respond_json(start_response, {"overrides": overrides})


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/scene-presets/(?P<scene_preset_id>\d+)/overrides")
def create_scene_override(environ, start_response, episode_id: str, scene_preset_id: str):
    payload = parse_json(environ)
    try:
        override_id = assets_service.upsert_episode_scene_override(
            int(episode_id), int(scene_preset_id), payload
        )
        override = assets_service.repository.get_episode_scene_override(override_id)
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="400 Bad Request")
    return respond_json(start_response, {"override": override}, status="201 Created")


@register("PUT", r"/api/episode-scene-overrides/(?P<override_id>\d+)")
def update_scene_override(environ, start_response, override_id: str):
    payload = parse_json(environ)
    existing = assets_service.repository.get_episode_scene_override(int(override_id))
    if not existing:
        return respond_json(start_response, {"error": "Override not found"}, status="404 Not Found")
    assets_service.repository.update_episode_scene_override(int(override_id), {
        "lighting_style": payload.get("lighting_style", ""),
        "time_of_day": payload.get("time_of_day", ""),
        "weather": payload.get("weather", ""),
    })
    return respond_json(start_response, {"override": assets_service.repository.get_episode_scene_override(int(override_id))})
