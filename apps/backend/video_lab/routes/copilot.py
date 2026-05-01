from __future__ import annotations

import json

from ..config import load_config, load_prompts
from ..providers.chatfire import ChatfireProvider
from . import _request_ctx, cors_headers, parse_json, register, respond_json

SUPPORTED_MODULES = {"brief", "character"}
SUPPORTED_INTENTS = {"generate", "rewrite", "expand", "compress", "fill_missing"}
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


def _extract_character_proposal(text: str) -> dict | None:
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
    raw_roles = proposal.get("roles")
    if isinstance(raw_roles, list):
        roles = raw_roles
    else:
        roles = [proposal]

    normalized_roles = []
    for role in roles:
        if not isinstance(role, dict):
            continue
        profile = role.get("character_profile") if isinstance(role.get("character_profile"), dict) else role
        image_spec = role.get("image_spec") if isinstance(role.get("image_spec"), dict) else {}
        normalized_roles.append({
            "character_profile": {
                "name": str(profile.get("name", "")),
                "role_type": str(profile.get("role_type", "")),
                "identity_summary": str(profile.get("identity_summary", "")),
                "appearance_summary": str(profile.get("appearance_summary", "")),
                "personality_tags": [str(item) for item in profile.get("personality_tags", []) if str(item).strip()],
                "speech_style": str(profile.get("speech_style", "")),
                "negative_constraints": str(profile.get("negative_constraints", "")),
            },
            "image_spec": {
                "gender_presentation": str(image_spec.get("gender_presentation", "")),
                "age_range": str(image_spec.get("age_range", "")),
                "body_type": str(image_spec.get("body_type", "")),
                "face_features": str(image_spec.get("face_features", "")),
                "hair_style": str(image_spec.get("hair_style", "")),
                "hair_color": str(image_spec.get("hair_color", "")),
                "eye_style": str(image_spec.get("eye_style", "")),
                "signature_expression": str(image_spec.get("signature_expression", "")),
                "signature_pose": str(image_spec.get("signature_pose", "")),
                "clothing_style": str(image_spec.get("clothing_style", "")),
                "color_palette": [str(item) for item in image_spec.get("color_palette", []) if str(item).strip()],
                "visual_keywords": [str(item) for item in image_spec.get("visual_keywords", []) if str(item).strip()],
                "negative_visual_constraints": [
                    str(item) for item in image_spec.get("negative_visual_constraints", []) if str(item).strip()
                ],
                "image_prompt": str(image_spec.get("image_prompt", "")),
                "negative_prompt": str(image_spec.get("negative_prompt", "")),
            },
        })

    if not normalized_roles:
        return None

    return {"roles": normalized_roles}


def _extract_proposal(module_type: str, text: str) -> dict | None:
    if module_type == "brief":
        return _extract_brief_proposal(text)
    if module_type == "character":
        return _extract_character_proposal(text)
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
