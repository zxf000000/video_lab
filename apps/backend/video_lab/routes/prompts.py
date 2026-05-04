from __future__ import annotations

import json

from ..config import load_config, load_prompts
from ..domain.assets import AssetsService
from ..domain.prompts import PromptsService
from ..domain.shots import ShotsService
from ..providers.chatfire import ChatfireProvider
from . import parse_json, register, respond_json, serialize_prompt

prompts_service = PromptsService()
shots_service = ShotsService()
assets_service = AssetsService()


@register("GET", r"/api/shots/(?P<shot_id>\d+)/prompts")
def list_prompts(environ, start_response, shot_id: str):
    prompts = prompts_service.list_prompts(int(shot_id))
    return respond_json(start_response, {"prompts": [serialize_prompt(p) for p in prompts]})


@register("POST", r"/api/shots/(?P<shot_id>\d+)/prompts")
def create_prompt(environ, start_response, shot_id: str):
    payload = parse_json(environ)
    prompt_id = prompts_service.create_prompt_version(int(shot_id), payload)
    return respond_json(
        start_response,
        {"prompt": serialize_prompt(prompts_service.get_prompt(prompt_id))},
        status="201 Created",
    )


@register("PUT", r"/api/prompts/(?P<prompt_id>\d+)")
def update_prompt(environ, start_response, prompt_id: str):
    payload = parse_json(environ)
    try:
        prompts_service.update_prompt(int(prompt_id), payload)
        prompt = prompts_service.get_prompt(int(prompt_id))
    except ValueError:
        return respond_json(start_response, {"error": "Prompt not found"}, status="404 Not Found")
    return respond_json(start_response, {"prompt": serialize_prompt(prompt)})


@register("POST", r"/api/prompts/(?P<prompt_id>\d+)/activate")
def activate_prompt(environ, start_response, prompt_id: str):
    try:
        prompts_service.activate_prompt(int(prompt_id))
        prompt = prompts_service.get_prompt(int(prompt_id))
    except ValueError:
        return respond_json(start_response, {"error": "Prompt not found"}, status="404 Not Found")
    return respond_json(start_response, {"prompt": serialize_prompt(prompt)})


START_MARKER = "===PROPOSAL==="
END_MARKER = "===END_PROPOSAL==="


def _extract_shot_prompt_proposal(text: str) -> dict | None:
    if START_MARKER not in text or END_MARKER not in text:
        return None
    start = text.index(START_MARKER) + len(START_MARKER)
    end = text.index(END_MARKER, start)
    raw = text[start:end].strip()
    try:
        proposal = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(proposal, dict):
        return None
    first_frame_prompt = str(proposal.get("first_frame_prompt", "")).strip()
    first_frame_negative_prompt = str(proposal.get("first_frame_negative_prompt", "")).strip()
    video_prompt = str(proposal.get("video_prompt", "")).strip()
    video_negative_prompt = str(proposal.get("video_negative_prompt", "")).strip()
    negative_prompt = str(proposal.get("negative_prompt", "")).strip()
    # Fallback: support old single prompt_text format
    if not first_frame_prompt:
        prompt_text = str(proposal.get("prompt_text", "")).strip()
        if prompt_text:
            first_frame_prompt = prompt_text
    if not first_frame_prompt:
        return None
    return {
        "first_frame_prompt": first_frame_prompt,
        "first_frame_negative_prompt": first_frame_negative_prompt,
        "video_prompt": video_prompt,
        "video_negative_prompt": video_negative_prompt,
        "negative_prompt": negative_prompt,
    }


_ORDINAL_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]


def _ordinal_label(index: int) -> str:
    if 1 <= index <= len(_ORDINAL_LABELS):
        return f"图{_ORDINAL_LABELS[index - 1]}"
    return f"图{index}"


@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate-prompt")
def generate_shot_prompt(environ, start_response, shot_id: str):
    try:
        shot = shots_service.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    # Collect image references: characters first, then scene
    image_refs = []  # list of {"label": "图一", "type": "character"/"scene", "name": ..., "path": ...}
    image_reference_lines = []  # for prompt template

    # Character images
    character_context = "无关联角色"
    character_ids_raw = shot.get("character_ids", "[]")
    if isinstance(character_ids_raw, str):
        try:
            character_ids = json.loads(character_ids_raw)
        except (json.JSONDecodeError, TypeError):
            character_ids = []
    elif isinstance(character_ids_raw, list):
        character_ids = character_ids_raw
    else:
        character_ids = []

    idx = 0
    char_descriptions = []
    if character_ids:
        for cid in character_ids[:5]:
            try:
                char = assets_service.get_character(int(cid))
                if char:
                    idx += 1
                    label = _ordinal_label(idx)
                    name = char.get("name", "角色")
                    image_path = char.get("image_path", "")
                    image_refs.append({"label": label, "type": "character", "name": name, "path": image_path})
                    image_reference_lines.append(f"{label} = {name} (角色图片)")
                    parts = [f"角色名: {name}"]
                    if char.get("appearance_summary"):
                        parts.append(f"外观: {char['appearance_summary']}")
                    if char.get("appearance_prompt"):
                        parts.append(f"外观提示词: {char['appearance_prompt']}")
                    if image_path:
                        parts.append(f"角色图片路径: /assets/{image_path}")
                    char_descriptions.append(" | ".join(parts))
            except Exception:
                continue
    if char_descriptions:
        character_context = "\n".join(char_descriptions)

    # Scene image
    scene_context = "无关联场景"
    scene_preset_id = shot.get("scene_preset_id")
    if scene_preset_id:
        try:
            scene = assets_service.get_scene_preset(int(scene_preset_id))
            if scene:
                idx += 1
                scene_label = _ordinal_label(idx)
                scene_name = scene.get("name", "场景")
                # Get first variant image path
                scene_image_path = ""
                variants = scene.get("variants", "[]")
                if isinstance(variants, str):
                    try:
                        variants = json.loads(variants)
                    except (json.JSONDecodeError, TypeError):
                        variants = []
                if isinstance(variants, list) and variants:
                    for v in variants:
                        if isinstance(v, dict) and v.get("imagePath"):
                            scene_image_path = v["imagePath"]
                            break
                image_refs.append({"label": scene_label, "type": "scene", "name": scene_name, "path": scene_image_path})
                image_reference_lines.append(f"{scene_label} = {scene_name} (场景图片)")

                scene_parts = [f"场景名称: {scene_name}"]
                if scene.get("space_description"):
                    scene_parts.append(f"空间描述: {scene['space_description']}")
                if scene.get("lighting_style"):
                    scene_parts.append(f"光线风格: {scene['lighting_style']}")
                if scene.get("time_of_day"):
                    scene_parts.append(f"时间: {scene['time_of_day']}")
                if scene.get("weather"):
                    scene_parts.append(f"天气: {scene['weather']}")
                if scene.get("image_prompt"):
                    scene_parts.append(f"场景图片提示词: {scene['image_prompt']}")
                if scene_image_path:
                    scene_parts.append(f"场景图片路径: /assets/{scene_image_path}")
                scene_context = "\n".join(scene_parts)
        except Exception:
            pass

    image_reference_list = "\n".join(image_reference_lines) if image_reference_lines else "无可用图片引用"

    prompts_cfg = load_prompts()
    system_prompt = prompts_cfg.get("prompt_copilot_shot_prompt_system", "")
    user_template = prompts_cfg.get("prompt_copilot_shot_prompt_generate", "")
    if not system_prompt or not user_template:
        return respond_json(start_response, {"error": "Shot prompt generation prompts are not configured"}, status="500 Internal Server Error")

    user_goal = user_template.format(
        shot_size=shot.get("shot_size", ""),
        camera_angle=shot.get("camera_angle", ""),
        camera_motion=shot.get("camera_motion", ""),
        composition=shot.get("composition", ""),
        action_description=shot.get("action_description", ""),
        facial_emotion=shot.get("facial_emotion", ""),
        dialogue_excerpt=shot.get("dialogue_excerpt", ""),
        visual_goal=shot.get("visual_goal", ""),
        scene_block=shot.get("scene_block", ""),
        image_reference_list=image_reference_list,
        scene_context=scene_context,
        character_context=character_context,
        project_id=shot.get("project_id", ""),
    )

    config = load_config()
    provider = ChatfireProvider(config)
    try:
        result_text = provider._chat(
            system=system_prompt,
            user=user_goal,
            timeout=90,
        )
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")

    proposal = _extract_shot_prompt_proposal(result_text or "")
    if not proposal:
        return respond_json(start_response, {"error": "Failed to generate prompt from LLM"}, status="500 Internal Server Error")

    return respond_json(start_response, {
        "first_frame_prompt": proposal["first_frame_prompt"],
        "first_frame_negative_prompt": proposal["first_frame_negative_prompt"],
        "video_prompt": proposal["video_prompt"],
        "video_negative_prompt": proposal["video_negative_prompt"],
        "negative_prompt": proposal["negative_prompt"],
        "image_references": image_refs,
    })

