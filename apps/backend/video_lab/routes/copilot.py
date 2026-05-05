from __future__ import annotations

import json

from ..config import AppConfig, load_config, load_prompts
from ..domain.story_dev.copilot_types import (
    CharacterCollectionProposalPayload,
    CharacterCopilotProposalPayload,
    CharacterImageSpecPayload,
    CharacterProfilePayload,
    CharacterProposalPayload,
    CharacterVariantCollectionProposalPayload,
    CharacterVariantImageSpecOverridePayload,
    CharacterVariantInheritRulesPayload,
    CharacterVariantProposalPayload,
)
from ..providers.chatfire import ChatfireProvider
from . import _request_ctx, cors_headers, parse_json, register, respond_json

SUPPORTED_MODULES = {"brief", "character", "scene", "episode", "shot"}
SUPPORTED_INTENTS = {"generate", "rewrite", "expand", "compress", "fill_missing", "regenerate", "optimize_prompt"}
START_MARKER = "===PROPOSAL==="
END_MARKER = "===END_PROPOSAL==="


def _normalize_messages(raw_messages: object) -> list[dict[str, str]]:
    if not isinstance(raw_messages, list):
        raise ValueError("messages is required")
    normalized: list[dict[str, str]] = []
    for item in raw_messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    if not normalized:
        raise ValueError("messages is required")
    return normalized


def _compile_messages(
    messages: list[dict[str, str]],
    *,
    user_template: str,
    context: dict,
    user_goal: str,
    project_id: int,
    entity_id: int | None,
) -> list[dict[str, str]]:
    compiled_goal = user_goal or "请基于当前上下文生成一版可直接回填的结构化建议。"
    context_json = json.dumps(context, ensure_ascii=False, indent=2)
    compiled_user = user_template.format(
        user_goal=compiled_goal,
        context_json=context_json,
        project_id=project_id,
        entity_id=entity_id or "",
    )
    history = messages[:-1] if len(messages) > 1 else []
    return history + [{"role": "user", "content": compiled_user}]


def _extract_brief_proposal(text: str) -> dict | None:
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
    return {
        "logline": str(proposal.get("logline", "")),
        "target_audience": str(proposal.get("target_audience", "")),
        "genre_tags": [str(item) for item in proposal.get("genre_tags", []) if str(item).strip()],
        "style_keywords": [str(item) for item in proposal.get("style_keywords", []) if str(item).strip()],
        "world_rules": str(proposal.get("world_rules", "")),
        "main_conflict": str(proposal.get("main_conflict", "")),
        "relationship_summary": str(proposal.get("relationship_summary", "")),
        "reversal_rules": str(proposal.get("reversal_rules", "")),
        "forbidden_rules": str(proposal.get("forbidden_rules", "")),
    }


def _normalize_character_profile(raw: dict) -> CharacterProfilePayload:
    return {
        "name": str(raw.get("name", "")),
        "role_type": str(raw.get("role_type", "")),
        "species": str(raw.get("species", "")),
        "identity_summary": str(raw.get("identity_summary", "")),
        "appearance_summary": str(raw.get("appearance_summary", "")),
        "personality_tags": [str(item) for item in raw.get("personality_tags", []) if str(item).strip()],
        "speech_style": str(raw.get("speech_style", "")),
        "negative_constraints": str(raw.get("negative_constraints", "")),
    }


def _normalize_character_image_spec(raw: dict) -> CharacterImageSpecPayload:
    return {
        "gender_presentation": str(raw.get("gender_presentation", "")),
        "age_range": str(raw.get("age_range", "")),
        "body_type": str(raw.get("body_type", "")),
        "face_features": str(raw.get("face_features", "")),
        "hair_style": str(raw.get("hair_style", "")),
        "hair_color": str(raw.get("hair_color", "")),
        "eye_style": str(raw.get("eye_style", "")),
        "signature_expression": str(raw.get("signature_expression", "")),
        "signature_pose": str(raw.get("signature_pose", "")),
        "clothing_style": str(raw.get("clothing_style", "")),
        "color_palette": [str(item) for item in raw.get("color_palette", []) if str(item).strip()],
        "visual_keywords": [str(item) for item in raw.get("visual_keywords", []) if str(item).strip()],
        "negative_visual_constraints": [
            str(item) for item in raw.get("negative_visual_constraints", []) if str(item).strip()
        ],
        "image_prompt": str(raw.get("image_prompt", "")),
        "negative_prompt": str(raw.get("negative_prompt", "")),
    }


def _normalize_character_proposal(raw: dict) -> CharacterProposalPayload:
    profile = raw.get("character_profile") if isinstance(raw.get("character_profile"), dict) else raw
    image_spec = raw.get("image_spec") if isinstance(raw.get("image_spec"), dict) else {}
    return {
        "character_profile": _normalize_character_profile(profile),
        "image_spec": _normalize_character_image_spec(image_spec),
    }


def _normalize_variant_inherit_rules(raw: dict) -> CharacterVariantInheritRulesPayload:
    return {
        "keep_face_identity": bool(raw.get("keep_face_identity", False)),
        "keep_age_range": bool(raw.get("keep_age_range", False)),
        "keep_body_type": bool(raw.get("keep_body_type", False)),
        "keep_core_temperament": bool(raw.get("keep_core_temperament", False)),
    }


def _normalize_variant_image_spec_override(raw: dict) -> CharacterVariantImageSpecOverridePayload:
    normalized: CharacterVariantImageSpecOverridePayload = {}
    text_keys = (
        "gender_presentation",
        "age_range",
        "body_type",
        "face_features",
        "hair_style",
        "hair_color",
        "eye_style",
        "signature_expression",
        "signature_pose",
        "clothing_style",
        "image_prompt",
        "negative_prompt",
    )
    list_keys = ("color_palette", "visual_keywords", "negative_visual_constraints")
    for key in text_keys:
        if key in raw:
            normalized[key] = str(raw.get(key, ""))
    for key in list_keys:
        if key in raw:
            normalized[key] = [str(item) for item in raw.get(key, []) if str(item).strip()]
    return normalized


def _normalize_variant_proposal(raw: dict) -> CharacterVariantProposalPayload:
    return {
        "variant_name": str(raw.get("variant_name", "")),
        "variant_type": str(raw.get("variant_type", "")),
        "trigger_reason": str(raw.get("trigger_reason", "")),
        "visual_changes_summary": str(raw.get("visual_changes_summary", "")),
        "inherit_rules": _normalize_variant_inherit_rules(
            raw.get("inherit_rules") if isinstance(raw.get("inherit_rules"), dict) else {}
        ),
        "image_spec_override": _normalize_variant_image_spec_override(
            raw.get("image_spec_override") if isinstance(raw.get("image_spec_override"), dict) else {}
        ),
    }


def _extract_character_proposal(text: str) -> CharacterCopilotProposalPayload | None:
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
    if isinstance(proposal.get("variants"), list):
        base_character_raw = proposal.get("base_character")
        base_character = (
            _normalize_character_proposal(base_character_raw)
            if isinstance(base_character_raw, dict)
            else None
        )
        variants: list[CharacterVariantProposalPayload] = []
        for raw_variant in proposal.get("variants", []):
            if not isinstance(raw_variant, dict):
                continue
            variants.append(_normalize_variant_proposal(raw_variant))
        if not variants:
            return None
        return {
            "mode": "character_variant",
            "base_character": base_character,
            "variants": variants,
        }
    raw_roles = proposal.get("roles")
    if isinstance(raw_roles, list):
        roles = raw_roles
    else:
        roles = [proposal]

    normalized_roles: list[CharacterProposalPayload] = []
    for role in roles:
        if not isinstance(role, dict):
            continue
        normalized_roles.append(_normalize_character_proposal(role))

    if not normalized_roles:
        return None

    return {
        "mode": "base_character",
        "roles": normalized_roles,
    }


def _normalize_scene(raw: dict) -> dict:
    return {
        "name": str(raw.get("name", "")),
        "scene_type": str(raw.get("scene_type", "")),
        "space_description": str(raw.get("space_description", "")),
        "lighting_style": str(raw.get("lighting_style", "")),
        "time_of_day": str(raw.get("time_of_day", "")),
        "weather": str(raw.get("weather", "")),
        "prop_list": [str(item) for item in raw.get("prop_list", []) if str(item).strip()],
        "negative_constraints": str(raw.get("negative_constraints", "")),
        "image_prompt": str(raw.get("image_prompt", "")),
        "negative_prompt": str(raw.get("negative_prompt", "")),
    }


def _extract_scene_proposal(text: str) -> dict | None:
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
    # batch mode: { "scenes": [...] }
    if isinstance(proposal.get("scenes"), list):
        scenes = [_normalize_scene(s) for s in proposal["scenes"] if isinstance(s, dict)]
        if not scenes:
            return None
        return {"scenes": scenes}
    # single mode: { "name": "...", ... }
    if proposal.get("name"):
        return {"scenes": [_normalize_scene(proposal)]}
    return None


def _normalize_episode(raw: dict) -> dict:
    """Normalize a single episode object from LLM output."""
    return {
        "episode_no": int(raw.get("episode_no", 0)),
        "title": str(raw.get("title", "")),
        "summary": str(raw.get("summary", "")),
        "goal": str(raw.get("goal", "")),
        "core_conflict": str(raw.get("core_conflict", "")),
        "opening_hook": str(raw.get("opening_hook", "")),
        "climax": str(raw.get("climax", "")),
        "ending_hook": str(raw.get("ending_hook", "")),
    }


def _extract_episode_proposal(text: str) -> dict | None:
    """Extract episode proposal(s) from LLM response."""
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
    # batch mode: { "episodes": [...] }
    if isinstance(proposal.get("episodes"), list):
        episodes = [_normalize_episode(ep) for ep in proposal["episodes"] if isinstance(ep, dict)]
        if not episodes:
            return None
        return {"episodes": episodes}
    # single mode: { "title": "...", ... }
    if proposal.get("title"):
        return {"episodes": [_normalize_episode(proposal)]}
    return None


def _normalize_shot(raw: dict) -> dict:
    """Normalize a single shot object from LLM output."""
    character_ids = raw.get("character_ids", [])
    if isinstance(character_ids, str):
        character_ids = [int(x) for x in character_ids.split(",") if x.strip().isdigit()]
    elif isinstance(character_ids, list):
        character_ids = [int(x) for x in character_ids if isinstance(x, (int, float)) or (isinstance(x, str) and x.strip().isdigit())]

    return {
        "shot_no": int(raw.get("shot_no", 0)),
        "scene_block": str(raw.get("scene_block", "")),
        "visual_goal": str(raw.get("visual_goal", "")),
        "shot_size": str(raw.get("shot_size", "")),
        "camera_angle": str(raw.get("camera_angle", "")),
        "composition": str(raw.get("composition", "")),
        "action_description": str(raw.get("action_description", "")),
        "facial_emotion": str(raw.get("facial_emotion", "")),
        "camera_motion": str(raw.get("camera_motion", "")),
        "dialogue_excerpt": str(raw.get("dialogue_excerpt", "")),
        "estimated_duration_ms": int(raw.get("estimated_duration_ms", 3000)),
        "scene_preset_id": raw.get("scene_preset_id"),
        "character_ids": character_ids,
    }


def _extract_shot_proposal(text: str) -> dict | None:
    """Extract shot proposal(s) from LLM response."""
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
    # batch mode: { "shots": [...] }
    if isinstance(proposal.get("shots"), list):
        shots = [_normalize_shot(s) for s in proposal["shots"] if isinstance(s, dict)]
        if not shots:
            return None
        return {"shots": shots}
    # single mode: { "shot_no": 1, ... }
    if proposal.get("shot_no") is not None:
        return {"shots": [_normalize_shot(proposal)]}
    return None


def _extract_proposal(module_type: str, text: str) -> dict | None:
    if module_type == "brief":
        return _extract_brief_proposal(text)
    if module_type == "character":
        return _extract_character_proposal(text)
    if module_type == "scene":
        return _extract_scene_proposal(text)
    if module_type == "episode":
        return _extract_episode_proposal(text)
    if module_type == "shot":
        return _extract_shot_proposal(text)
    return None


def _stream_full_chunks(provider: ChatfireProvider, messages: list[dict[str, str]], system_prompt: str):
    full_text = ""
    for delta in provider.chat_stream(messages, system_prompt):
        full_text += delta
        yield ("delta", delta)
    yield ("full_text", full_text)


@register("POST", r"/api/copilot/stream")
def stream_copilot(environ, start_response):
    payload = parse_json(environ)
    module_type = str(payload.get("module_type", "")).strip()
    if module_type not in SUPPORTED_MODULES:
        return respond_json(start_response, {"error": f"Unsupported module_type: {module_type}"}, status="400 Bad Request")

    intent = str(payload.get("intent", "")).strip()
    if intent not in SUPPORTED_INTENTS:
        return respond_json(start_response, {"error": f"Unsupported intent: {intent}"}, status="400 Bad Request")

    try:
        project_id = int(payload.get("project_id"))
    except (TypeError, ValueError):
        return respond_json(start_response, {"error": "project_id is required"}, status="400 Bad Request")

    raw_entity_id = payload.get("entity_id")
    try:
        entity_id = int(raw_entity_id) if raw_entity_id not in (None, "") else None
    except (TypeError, ValueError):
        entity_id = None

    context = payload.get("context")
    if not isinstance(context, dict):
        return respond_json(start_response, {"error": "context is required"}, status="400 Bad Request")

    try:
        messages = _normalize_messages(payload.get("messages"))
    except ValueError as exc:
        return respond_json(start_response, {"error": str(exc)}, status="400 Bad Request")

    prompts = load_prompts()
    system_prompt = prompts.get(f"prompt_copilot_{module_type}_system", "")
    user_template = prompts.get(f"prompt_copilot_{module_type}_{intent}", "")
    if not system_prompt or not user_template:
        return respond_json(start_response, {"error": "Copilot prompts are not configured"}, status="500 Internal Server Error")

    user_goal = messages[-1]["content"]
    compiled_messages = _compile_messages(
        messages,
        user_template=user_template,
        context=context,
        user_goal=user_goal,
        project_id=project_id,
        entity_id=entity_id,
    )

    config = load_config()
    provider = ChatfireProvider(config, prompts)

    start_response("200 OK", [
        ("Content-Type", "text/event-stream"),
        ("Cache-Control", "no-cache"),
        ("X-Accel-Buffering", "no"),
        *cors_headers(),
    ])

    def generate():
        try:
            full_text = ""
            for event_type, content in _stream_full_chunks(provider, compiled_messages, system_prompt):
                if event_type == "delta":
                    body = json.dumps({"type": "delta", "content": content}, ensure_ascii=False)
                    yield f"data: {body}\n\n".encode("utf-8")
                else:
                    full_text = content

            proposal = _extract_proposal(module_type, full_text)
            if proposal is None:
                body = json.dumps({"type": "error", "error": "Unable to parse copilot proposal"}, ensure_ascii=False)
                yield f"data: {body}\n\n".encode("utf-8")
            else:
                body = json.dumps({"type": "proposal", "proposal": proposal}, ensure_ascii=False)
                yield f"data: {body}\n\n".encode("utf-8")
            yield b'data: {"type":"done"}\n\n'
        except Exception as exc:
            body = json.dumps({"type": "error", "error": str(exc)}, ensure_ascii=False)
            yield f"data: {body}\n\n".encode("utf-8")
            yield b'data: {"type":"done"}\n\n'

    return generate()


# ── 评价端点 ──────────────────────────────────────────────

EVAL_MODEL = "gpt-5-mini"  # 评价专用模型，避免 reasoning tokens 问题

def _build_eval_prompt(module_type: str, proposal: dict, context: dict) -> str:
    """构建评价 prompt"""
    prompts = load_prompts()
    template = prompts.get(f"prompt_eval_{module_type}", "")
    if not template:
        return ""

    if module_type == "character":
        roles = proposal.get("roles", [])
        role = roles[0] if roles else proposal
        profile = json.dumps(role.get("character_profile", {}), ensure_ascii=False)
        image_spec = json.dumps(role.get("image_spec", {}), ensure_ascii=False)
        existing = context.get("existing_characters", [])
        existing_info = ""
        if existing:
            names = [c.get("character_profile", {}).get("name", "?") for c in existing]
            existing_info = f"\n已有角色: {', '.join(names)}"
        brief = json.dumps(context.get("brief_summary", {}), ensure_ascii=False)
        return template.format(
            brief=brief[:500], profile=profile[:500],
            image_spec=image_spec[:800], existing_info=existing_info,
        )

    if module_type == "brief":
        brief = json.dumps(proposal, ensure_ascii=False)
        brief_summary = context.get("brief_summary", context)
        return template.format(
            brief=brief[:600],
            target_audience=brief_summary.get("target_audience", ""),
            genre=brief_summary.get("genre", context.get("project_summary", {}).get("genre", "")),
        )

    return ""


@register("POST", r"/api/copilot/evaluate")
def evaluate_proposal(environ, start_response):
    """评价 copilot 生成的 proposal"""
    payload = parse_json(environ)

    module_type = str(payload.get("module_type", "")).strip()
    if module_type not in SUPPORTED_MODULES:
        return respond_json(start_response, {"error": f"Unsupported module_type: {module_type}"}, status="400 Bad Request")

    proposal = payload.get("proposal")
    if not isinstance(proposal, dict):
        return respond_json(start_response, {"error": "proposal is required"}, status="400 Bad Request")

    context = payload.get("context", {})

    prompt = _build_eval_prompt(module_type, proposal, context)
    if not prompt:
        return respond_json(start_response, {"error": "No eval prompt for module_type"}, status="400 Bad Request")

    # 用评价专用模型调用 LLM（带重试）
    config = load_config()
    eval_config = AppConfig(
        api_base=config.api_base,
        api_key=config.api_key,
        text_model=EVAL_MODEL,
        max_tokens=2000,
        temperature=0.3,
        request_timeout=90,
        max_retries=3,
    )
    provider = ChatfireProvider(eval_config)

    result_text = None
    last_error = None
    for attempt in range(3):
        try:
            result_text = provider._chat(
                system="你是短剧评审专家，只输出JSON评分。",
                user=prompt,
                timeout=90,
            )
            break
        except Exception as exc:
            last_error = exc
            continue

    if result_text is None:
        return respond_json(start_response, {"error": f"LLM call failed after 3 retries: {last_error}"}, status="500 Internal Server Error")

    # 解析 JSON
    result_text = result_text.strip()
    if "```" in result_text:
        parts = result_text.split("```")
        for part in parts[1::2]:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                result_text = part
                break
    if not result_text.startswith("{"):
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start >= 0 and end > start:
            result_text = result_text[start:end]

    try:
        scores = json.loads(result_text)
    except json.JSONDecodeError:
        return respond_json(start_response, {"error": "Failed to parse LLM output", "raw": result_text[:500]}, status="500 Internal Server Error")

    # 计算总分
    score_keys = [k for k in scores if isinstance(scores[k], dict) and "score" in scores[k]]
    total = sum(scores[k]["score"] for k in score_keys)
    max_score = len(score_keys) * 10

    if max_score > 0:
        pct = total / max_score * 100
        if pct >= 85:
            grade = "A"
        elif pct >= 70:
            grade = "B"
        elif pct >= 55:
            grade = "C"
        elif pct >= 40:
            grade = "D"
        else:
            grade = "F"
    else:
        grade = "?"

    return respond_json(start_response, {
        "scores": scores,
        "total": total,
        "max": max_score,
        "grade": grade,
    })
