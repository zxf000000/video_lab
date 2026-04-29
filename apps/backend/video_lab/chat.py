from __future__ import annotations

import json
import re

from .config import load_config, load_prompts
from .providers.chatfire import ChatfireProvider


def handle_chat_stream(payload: dict, start_response):
    messages = payload.get("messages", [])
    if not messages:
        start_response("400 Bad Request", [
            ("Content-Type", "application/json"),
        ])
        return [b'{"error":"messages is required"}']

    prompts = load_prompts()
    system_prompt = prompts.get("prompt_conversation_system", "")

    config = load_config()
    provider = ChatfireProvider(config, prompts)

    start_response("200 OK", [
        ("Content-Type", "text/event-stream"),
        ("Cache-Control", "no-cache"),
        ("X-Accel-Buffering", "no"),
        ("Access-Control-Allow-Origin", "*"),
    ])

    def generate():
        full_content = ""
        for delta in provider.chat_stream(messages, system_prompt):
            full_content += delta
            event = json.dumps({"type": "delta", "content": delta}, ensure_ascii=False)
            yield f"data: {event}\n\n".encode("utf-8")

        extracted = _try_extract_params(full_content)
        if extracted:
            event = json.dumps({"type": "extracted", "project_params": extracted}, ensure_ascii=False)
            yield f"data: {event}\n\n".encode("utf-8")

        yield b"data: [DONE]\n\n"

    return generate()


def _try_extract_params(text: str) -> dict | None:
    match = re.search(r"===EXTRACT===\s*(\{.*?\})\s*===END===", text, re.DOTALL)
    if not match:
        return None
    try:
        params = json.loads(match.group(1))
        required = {"title", "story_prompt", "style", "aspect_ratio", "target_duration"}
        if not required.issubset(params.keys()):
            return None
        params["title"] = str(params["title"]).strip()
        params["story_prompt"] = str(params["story_prompt"]).strip()
        params["style"] = str(params.get("style", "cinematic")).strip() or "cinematic"
        params["aspect_ratio"] = str(params.get("aspect_ratio", "16:9")).strip() or "16:9"
        params["target_duration"] = max(5, min(120, int(params.get("target_duration", 30))))
        return params
    except (json.JSONDecodeError, ValueError, TypeError):
        return None
