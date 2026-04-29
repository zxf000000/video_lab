"""Config, models, and prompts API routes."""
from __future__ import annotations

from .. import repository, services
from ..config import (
    load_config, load_models, load_vendors, load_prompts,
    DEFAULT_PROMPTS, PROMPT_VARS, save_all, save_models_only,
)
from . import register, respond_json, parse_json


def _config_response(cfg):
    masked_key = ""
    if cfg.api_key:
        masked_key = cfg.api_key[:6] + "..." + cfg.api_key[-4:] if len(cfg.api_key) > 10 else "***"
    return {
        "config": {
            "text_model": cfg.text_model,
            "image_model": cfg.image_model,
            "video_model": cfg.video_model,
            "voice_model": cfg.voice_model,
            "api_base": cfg.api_base,
            "api_key_masked": masked_key,
            "has_api_key": bool(cfg.api_key),
        }
    }


@register("GET", r"/api/health")
def health(environ, start_response):
    return respond_json(start_response, {"ok": True})


@register("GET", r"/api/config")
def get_config(environ, start_response):
    return respond_json(start_response, _config_response(load_config()))


@register("PUT", r"/api/config")
def put_config(environ, start_response):
    payload = parse_json(environ)
    save_all(payload)
    services.reload_providers()
    return respond_json(start_response, _config_response(load_config()))


@register("GET", r"/api/models")
def get_models(environ, start_response):
    return respond_json(start_response, {"models": load_models()})


@register("GET", r"/api/models/vendors")
def get_vendors(environ, start_response):
    return respond_json(start_response, {"vendors": load_vendors()})


@register("PUT", r"/api/models")
def put_models(environ, start_response):
    payload = parse_json(environ)
    models = payload.get("models", {})
    for cat in ("text", "image", "video", "voice"):
        if cat in models and not isinstance(models[cat], list):
            return respond_json(start_response, {"error": f"models.{cat} must be a list"}, status="400 Bad Request")
    save_models_only(models)
    return respond_json(start_response, {"models": load_models()})


@register("PUT", r"/api/models/(?P<category>text|image|video|voice)")
def put_model_category(environ, start_response, category: str):
    payload = parse_json(environ)
    model_id = str(payload.get("id", "")).strip()
    model_label = str(payload.get("label", "")).strip()
    if not model_id:
        return respond_json(start_response, {"error": "id is required"}, status="400 Bad Request")
    if not model_label:
        model_label = model_id
    models = load_models()
    cat_list = models.get(category, [])
    found = False
    for i, m in enumerate(cat_list):
        if m["id"] == model_id:
            cat_list[i] = {"id": model_id, "label": model_label}
            found = True
            break
    if not found:
        cat_list.append({"id": model_id, "label": model_label})
    models[category] = cat_list
    save_models_only(models)
    return respond_json(start_response, {"models": models})


@register("DELETE", r"/api/models/(?P<category>text|image|video|voice)")
def delete_model(environ, start_response, category: str):
    from urllib.parse import parse_qs
    qs = parse_qs(environ.get("QUERY_STRING", ""))
    model_id = qs.get("id", [""])[0]
    if not model_id:
        return respond_json(start_response, {"error": "id query param required"}, status="400 Bad Request")
    models = load_models()
    cat_list = models.get(category, [])
    models[category] = [m for m in cat_list if m["id"] != model_id]
    save_models_only(models)
    return respond_json(start_response, {"models": models})


@register("GET", r"/api/prompts")
def get_prompts(environ, start_response):
    return respond_json(start_response, {
        "prompts": load_prompts(),
        "defaults": DEFAULT_PROMPTS,
        "vars": PROMPT_VARS,
    })


@register("PUT", r"/api/prompts")
def put_prompts(environ, start_response):
    payload = parse_json(environ)
    to_save = {}
    for k, v in payload.items():
        if k.startswith("prompt_") and isinstance(v, str):
            to_save[k] = v
    if to_save:
        repository.set_settings(to_save)
        services.reload_providers()
    return respond_json(start_response, {
        "prompts": load_prompts(),
        "defaults": DEFAULT_PROMPTS,
        "vars": PROMPT_VARS,
    })
