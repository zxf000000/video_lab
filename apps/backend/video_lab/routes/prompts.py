from __future__ import annotations

from ..domain.prompts import PromptsService
from . import parse_json, register, respond_json, serialize_prompt

prompts_service = PromptsService()


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

