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

def _llm_match_locations(unmatched: list[str], preset_names: list[str], project_id: int) -> dict[str, str | None]:
    """Use LLM to match unmatched location names to existing preset names."""
    try:
        config = load_config()
        prompts = load_prompts()
        provider = ChatfireProvider(config, prompts)

        system = "你是一个场景名称匹配助手。判断给定的位置名称是否和已有场景指同一物理空间（同一空间只是不同叫法）。"
        user_msg = (
            f"已有场景名称：{json.dumps(preset_names, ensure_ascii=False)}\n"
            f"待匹配位置：{json.dumps(unmatched, ensure_ascii=False)}\n\n"
            "判断每个待匹配位置是否和已有场景指同一物理空间。"
            "返回纯 JSON（不要用 Markdown 代码块），格式："
            '{"待匹配位置名称": "已有场景名称"}\n'
            "不匹配的不要包含在结果中。"
        )
        raw = provider._chat(system, user_msg, timeout=60)
        json_text = raw.strip()
        if "```" in json_text:
            lines = json_text.split("\n")
            json_lines = [l for l in lines if not l.startswith("```")]
            json_text = "\n".join(json_lines)
        result = json.loads(json_text)
        if isinstance(result, dict):
            return {k: v for k, v in result.items() if isinstance(k, str) and isinstance(v, str)}
    except Exception:
        pass
    return {}


def _derive_override_from_location(location: str, screenplay_scenes: list[dict], preset: dict) -> dict:
    """Derive lighting_style, time_of_day, weather from screenplay scene context."""
    for scene in screenplay_scenes:
        if not isinstance(scene, dict):
            continue
        if (scene.get("location") or "").strip() == location:
            loc = location
            for sep in (" - ", " — ", "·"):
                if sep in loc:
                    parts = loc.split(sep)
                    last = parts[-1].strip()
                    if last in ("日", "夜", "白天", "夜晚", "黄昏", "清晨", "傍晚", "午", "深夜", "早晨"):
                        return {
                            "time_of_day": last,
                            "lighting_style": preset.get("lighting_style", ""),
                            "weather": preset.get("weather", ""),
                        }
            break
    return {
        "lighting_style": preset.get("lighting_style", ""),
        "time_of_day": preset.get("time_of_day", ""),
        "weather": preset.get("weather", ""),
    }


def _run_generate_scenes(task_id: int, episode_id: int, project_id: int, context: dict, messages: list[dict]) -> None:
    gen_svc = GenerationService()
    assets_svc = AssetsService()
    shots_svc = ShotsService()
    try:
        gen_svc.repository.update_task(task_id, {"status": "running"})

        # 1. Load episode → get screenplay_scenes
        episode = shots_svc.repository.get_episode(episode_id)
        if not episode:
            raise RuntimeError("Episode not found")
        screenplay_scenes_raw = episode.get("screenplay_scenes", "[]")
        if isinstance(screenplay_scenes_raw, str):
            try:
                screenplay_scenes = json.loads(screenplay_scenes_raw)
            except (json.JSONDecodeError, TypeError):
                screenplay_scenes = []
        else:
            screenplay_scenes = screenplay_scenes_raw

        if not screenplay_scenes:
            raise RuntimeError("Episode has no screenplay scenes — generate screenplay first")

        # 2. Parse locations from screenplay scenes, deduplicate
        locations: list[str] = []
        seen: set[str] = set()
        for scene in screenplay_scenes:
            if not isinstance(scene, dict):
                continue
            loc = (scene.get("location") or "").strip()
            if loc and loc not in seen:
                locations.append(loc)
                seen.add(loc)

        if not locations:
            raise RuntimeError("No locations found in screenplay scenes")

        # 3. Load all existing scene_presets for this project
        presets = assets_svc.repository.list_scene_presets(project_id)
        preset_names = [(p.get("name") or "").strip() for p in presets if (p.get("name") or "").strip()]

        # 4. Rule-based match
        match_result = assets_svc.match_locations_to_presets(project_id, locations)
        unmatched = [loc for loc, pid in match_result.items() if pid is None]

        # 5. LLM match for unresolved locations
        if unmatched and preset_names:
            llm_matches = _llm_match_locations(unmatched, preset_names, project_id)
            for loc, matched_name in llm_matches.items():
                if matched_name:
                    for p in presets:
                        if (p.get("name") or "").strip() == matched_name:
                            match_result[loc] = int(p["id"])
                            if loc in unmatched:
                                unmatched.remove(loc)
                            break

        # 6. Generate new scene presets for unmatched locations
        created_preset_ids: list[int] = []
        if unmatched:
            prompts = load_prompts()
            config = load_config()
            provider = ChatfireProvider(config, prompts)
            system_prompt = prompts.get("prompt_copilot_scene_system", "")
            user_template = prompts.get("prompt_copilot_scene_generate", "")

            if not system_prompt or not user_template:
                raise RuntimeError("Scene copilot prompts are not configured")

            gen_context = {
                "unmatched_locations": unmatched,
                "project_id": project_id,
                "episode_id": episode_id,
            }
            user_goal = f"请为以下新场景位置生成场景预设：{', '.join(unmatched)}"
            compiled_messages = _compile_messages(
                messages if messages else [{"role": "user", "content": user_goal}],
                user_template=user_template,
                context=gen_context,
                user_goal=user_goal,
                project_id=project_id,
                entity_id=episode_id,
            )
            full_text = ""
            for delta in provider.chat_stream(compiled_messages, system_prompt):
                full_text += delta
            proposal = _extract_scene_proposal(full_text)
            if proposal and proposal.get("scenes"):
                for scene in proposal["scenes"]:
                    sid = assets_svc.repository.create_scene_preset({
                        "project_id": project_id,
                        "name": (scene.get("name") or "").strip(),
                        "scene_type": str(scene.get("scene_type", "")).strip(),
                        "space_description": str(scene.get("space_description", "")).strip(),
                        "lighting_style": str(scene.get("lighting_style", "")).strip(),
                        "time_of_day": str(scene.get("time_of_day", "")).strip(),
                        "weather": str(scene.get("weather", "")).strip(),
                        "prop_list": json.dumps([str(item) for item in scene.get("prop_list", []) if str(item).strip()], ensure_ascii=False),
                        "negative_constraints": str(scene.get("negative_constraints", "")).strip(),
                        "image_prompt": str(scene.get("image_prompt", "")).strip(),
                        "negative_prompt": str(scene.get("negative_prompt", "")).strip(),
                        "reference_asset_ids": "[]",
                        "variants": "[]",
                        "status": "draft",
                        "version_no": 1,
                    })
                    created_preset_ids.append(sid)
                    # Map the newly created preset to unmatched locations
                    for loc in unmatched:
                        if match_result.get(loc) is None:
                            created_name = (scene.get("name") or "").strip()
                            if created_name:
                                match_result[loc] = sid
                                break

        # 7. Create episode_scene_overrides for all matched/generated locations
        override_ids: list[int] = []
        for loc, pid in match_result.items():
            if pid is None:
                continue
            preset = assets_svc.repository.get_scene_preset(pid)
            if not preset:
                continue
            override_payload = _derive_override_from_location(loc, screenplay_scenes, preset)
            oid = assets_svc.repository.upsert_episode_scene_override(
                episode_id, pid, override_payload
            )
            override_ids.append(oid)

        all_preset_ids = [pid for pid in match_result.values() if pid is not None]
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([
                {
                    "type": "scenes",
                    "scene_ids": all_preset_ids,
                    "new_scene_ids": created_preset_ids,
                    "override_ids": override_ids,
                }
            ], ensure_ascii=False),
        })
    except Exception as exc:
        gen_svc.repository.update_task(task_id, {"status": "failed", "error_message": str(exc)[:500]})


# ── Spatial context builder ──────────────────────────────────────

def _inject_spatial_context(context: dict, scenes: list[dict], project_id: int) -> None:
    """Enrich screenplay_scenes with space_description from scene_presets
    and build a spatial_flow summary describing physical transitions."""
    from ..domain.assets import AssetsService

    assets_svc = AssetsService()
    presets = assets_svc.repository.list_scene_presets(project_id)

    # Build lookup by name (strip time-of-day suffix like " - 夜", " - 日")
    preset_by_name: dict[str, dict] = {}
    for p in presets:
        name = (p.get("name") or "").strip()
        if name:
            preset_by_name[name] = dict(p)

    def _match_preset(location: str) -> dict | None:
        loc = location.strip()
        if loc in preset_by_name:
            return preset_by_name[loc]
        # Try substring match
        for name, p in preset_by_name.items():
            if name in loc or loc in name:
                return p
        return None

    # Enrich each scene with space metadata
    for scene in scenes:
        loc = scene.get("location", "")
        preset = _match_preset(loc) if loc else None
        if preset:
            scene.setdefault("space_description", preset.get("space_description", ""))
            scene.setdefault("lighting_style", preset.get("lighting_style", ""))
            scene.setdefault("time_of_day", preset.get("time_of_day", ""))

    # Build spatial flow: describe movement trajectory across scenes
    flow_lines: list[str] = []
    prev_name: str | None = None
    prev_label: str | None = None
    for i, scene in enumerate(scenes):
        scene_no = scene.get("scene_no", i + 1)
        label = f"S{scene_no}"
        loc = (scene.get("location") or "").strip()
        preset = _match_preset(loc) if loc else None
        space_name = (preset.get("name") or loc) if preset else loc
        space_desc = (preset.get("space_description") or "")[:200] if preset else ""

        if i == 0:
            flow_lines.append(f"{label}「{space_name}」开场: {space_desc}")
        else:
            transition = (
                f"{prev_label} → {label}: "
                f"角色从「{prev_name}」移动到「{space_name}」。"
            )
            if space_desc:
                transition += f" 目标空间: {space_desc}"
            flow_lines.append(transition)

        prev_name = space_name
        prev_label = label

    if flow_lines:
        context.setdefault("spatial_flow", "\n".join(flow_lines))


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
                # Build spatial flow: enrich scenes with space_description from presets
                if scenes:
                    _inject_spatial_context(context, scenes, project_id)
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
