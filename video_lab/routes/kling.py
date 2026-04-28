"""Kling (可灵) API routes."""
from __future__ import annotations

from .. import repository
from ..config import load_kling_config, save_kling_config
from ..jobs import submit_project_task
from . import register, respond_json, parse_json, parse_qs_param


def _kling_config_response(cfg):
    ak = cfg.kling_access_key
    sk = cfg.kling_secret_key
    return {
        "config": {
            "kling_api_base": cfg.kling_api_base,
            "kling_access_key_masked": (ak[:6] + "..." + ak[-4:]) if len(ak) > 10 else "",
            "kling_secret_key_masked": (sk[:6] + "..." + sk[-4:]) if len(sk) > 10 else "",
            "has_kling_access_key": bool(ak),
            "has_kling_secret_key": bool(sk),
        }
    }


@register("GET", r"/api/kling/config")
def get_kling_config(environ, start_response):
    return respond_json(start_response, _kling_config_response(load_kling_config()))


@register("PUT", r"/api/kling/config")
def put_kling_config(environ, start_response):
    payload = parse_json(environ)
    save_kling_config(payload)
    return respond_json(start_response, _kling_config_response(load_kling_config()))


@register("POST", r"/api/kling/t2v")
def kling_t2v(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt required"}, status="400 Bad Request")
    model_name = str(payload.get("model_name", "kling-v1")).strip() or "kling-v1"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    duration = str(payload.get("duration", "5")).strip() or "5"
    mode = str(payload.get("mode", "std")).strip() or "std"
    negative_prompt = str(payload.get("negative_prompt", "")).strip()
    sound = str(payload.get("sound", "")).strip()
    project_id = repository.create_quick_video_project(f"Kling T2V: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "kling",
                                  method="generate_t2v", prompt=prompt, model_name=model_name,
                                  aspect_ratio=aspect_ratio, duration=duration, mode=mode,
                                  negative_prompt=negative_prompt, sound=sound)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/kling/i2v")
def kling_i2v(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    image = str(payload.get("image", "")).strip()
    image_tail = str(payload.get("image_tail", "")).strip()
    model_name = str(payload.get("model_name", "kling-v1")).strip() or "kling-v1"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    duration = str(payload.get("duration", "5")).strip() or "5"
    mode = str(payload.get("mode", "std")).strip() or "std"
    negative_prompt = str(payload.get("negative_prompt", "")).strip()
    sound = str(payload.get("sound", "")).strip()
    project_id = repository.create_quick_video_project(f"Kling I2V: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "kling",
                                  method="generate_i2v", prompt=prompt, image=image,
                                  image_tail=image_tail, model_name=model_name,
                                  aspect_ratio=aspect_ratio, duration=duration, mode=mode,
                                  negative_prompt=negative_prompt, sound=sound)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/kling/image")
def kling_image(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt required"}, status="400 Bad Request")
    model_name = str(payload.get("model_name", "kling-v1")).strip() or "kling-v1"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    negative_prompt = str(payload.get("negative_prompt", "")).strip()
    project_id = repository.create_quick_video_project(f"Kling Image: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "kling",
                                  method="generate_image", prompt=prompt, model_name=model_name,
                                  aspect_ratio=aspect_ratio, negative_prompt=negative_prompt)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/kling/omni-image")
def kling_omni_image(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt required"}, status="400 Bad Request")
    image_list = payload.get("image_list", [])
    if not isinstance(image_list, list):
        image_list = []
    model_name = str(payload.get("model_name", "kling-image-o1")).strip() or "kling-image-o1"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    resolution = str(payload.get("resolution", "1k")).strip() or "1k"
    n = int(payload.get("n", 1))
    negative_prompt = str(payload.get("negative_prompt", "")).strip()
    project_id = repository.create_quick_video_project(f"Kling Omni: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "kling",
                                  method="generate_omni_image", prompt=prompt,
                                  image_list=image_list, model_name=model_name,
                                  aspect_ratio=aspect_ratio, resolution=resolution, n=n,
                                  negative_prompt=negative_prompt)
    return respond_json(start_response, {"task_id": task_id})


@register("POST", r"/api/kling/omni-video")
def kling_omni_video(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt required"}, status="400 Bad Request")
    image_list = payload.get("image_list", [])
    if not isinstance(image_list, list):
        image_list = []
    model_name = str(payload.get("model_name", "kling-video-o1")).strip() or "kling-video-o1"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    duration = str(payload.get("duration", "5")).strip() or "5"
    mode = str(payload.get("mode", "std")).strip() or "std"
    project_id = repository.create_quick_video_project(f"Kling Omni Video: {prompt[:50]}", aspect_ratio)
    task_id = submit_project_task(project_id, "kling",
                                  method="generate_omni_video", prompt=prompt,
                                  image_list=image_list, model_name=model_name,
                                  aspect_ratio=aspect_ratio, duration=duration, mode=mode)
    return respond_json(start_response, {"task_id": task_id})


@register("GET", r"/api/kling/status")
def kling_status(environ, start_response):
    task_id = int(parse_qs_param(environ, "task_id", "0"))
    task = repository.get_task(task_id)
    if not task:
        return respond_json(start_response, {"error": "Task not found"}, status="404 Not Found")
    video_url = f"/assets/{task['output_url']}" if task.get("output_url") else None
    return respond_json(start_response, {
        "task_id": task["id"], "status": task["status"],
        "video_url": video_url, "error_message": task.get("error_message"),
    })


@register("GET", r"/api/kling/tasks")
def kling_tasks(environ, start_response):
    tasks = repository.list_kling_tasks()
    for t in tasks:
        t["output_path"] = t.get("output_url") or ""
    return respond_json(start_response, {"tasks": tasks})
