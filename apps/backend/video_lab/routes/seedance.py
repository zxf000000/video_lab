"""Seedance 2.0 API routes."""
from __future__ import annotations

from .. import repository
from ..config import load_seedance_config, save_seedance_config
from ..jobs import submit_project_task
from . import register, respond_json, parse_json, parse_qs_param, serialize_task


def _seedance_config_response(cfg):
    key = cfg.seedance_api_key
    return {
        "config": {
            "seedance_api_base": cfg.seedance_api_base,
            "seedance_api_key_masked": (key[:6] + "..." + key[-4:]) if len(key) > 10 else "",
            "has_seedance_api_key": bool(key),
        }
    }


@register("GET", r"/api/seedance/config")
def get_seedance_config(environ, start_response):
    return respond_json(start_response, _seedance_config_response(load_seedance_config()))


@register("PUT", r"/api/seedance/config")
def put_seedance_config(environ, start_response):
    payload = parse_json(environ)
    save_seedance_config(payload)
    return respond_json(start_response, _seedance_config_response(load_seedance_config()))


@register("POST", r"/api/seedance/t2v")
def seedance_t2v(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt required"}, status="400 Bad Request")
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    resolution = str(payload.get("resolution", "720p")).strip() or "720p"
    duration = int(payload.get("duration", 5) or 5)
    remove_watermark = bool(payload.get("remove_watermark", False))
    project_id = repository.create_quick_video_project(f"Seedance T2V: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "seedance_t2v",
                                  prompt=prompt, aspect_ratio=aspect_ratio,
                                  resolution=resolution, duration=duration,
                                  remove_watermark=remove_watermark)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/seedance/i2v")
def seedance_i2v(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    images_list = payload.get("images_list", [])
    if not images_list:
        return respond_json(start_response, {"error": "images_list required"}, status="400 Bad Request")
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    resolution = str(payload.get("resolution", "720p")).strip() or "720p"
    duration = int(payload.get("duration", 5) or 5)
    remove_watermark = bool(payload.get("remove_watermark", False))
    project_id = repository.create_quick_video_project(f"Seedance I2V: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "seedance_i2v",
                                  prompt=prompt, images_list=images_list,
                                  aspect_ratio=aspect_ratio, resolution=resolution,
                                  duration=duration, remove_watermark=remove_watermark)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/seedance/character")
def seedance_character(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    images_list = payload.get("images_list", [])
    if not images_list:
        return respond_json(start_response, {"error": "images_list required"}, status="400 Bad Request")
    project_id = repository.create_quick_video_project("Seedance Character", "16:9")
    task_id = submit_project_task(project_id, "seedance_character",
                                  images_list=images_list, prompt=prompt,
                                  aspect_ratio=payload.get("aspect_ratio", "16:9"),
                                  resolution=payload.get("resolution", "720p"),
                                  duration=int(payload.get("duration", 5)),
                                  remove_watermark=payload.get("remove_watermark", False))
    return respond_json(start_response, {"task_id": task_id})


@register("GET", r"/api/seedance/status")
def seedance_status(environ, start_response):
    task_id = int(parse_qs_param(environ, "task_id", "0"))
    task = repository.get_task(task_id)
    if not task:
        return respond_json(start_response, {"error": "Task not found"}, status="404 Not Found")
    video_url = f"/assets/{task['output_url']}" if task.get("output_url") else None
    return respond_json(start_response, {
        "task_id": task["id"], "status": task["status"],
        "video_url": video_url, "error_message": task.get("error_message"),
    })


@register("GET", r"/api/seedance/tasks")
def seedance_tasks(environ, start_response):
    tasks = repository.list_seedance_tasks()
    for t in tasks:
        t["output_path"] = t.get("output_url") or ""
    return respond_json(start_response, {"tasks": tasks})
