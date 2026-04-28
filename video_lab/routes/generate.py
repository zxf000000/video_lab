"""Quick video/image generation routes."""
from __future__ import annotations

from .. import repository
from ..config import load_config
from ..jobs import submit_project_task
from . import register, respond_json, parse_json, parse_qs_param


@register("POST", r"/api/generate-video")
def generate_video(environ, start_response):
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt is required"}, status="400 Bad Request")
    style = str(payload.get("style", "cinematic")).strip() or "cinematic"
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    target_duration = int(payload.get("target_duration", 5) or 5)
    target_duration = max(5, min(120, target_duration))
    image_urls = payload.get("image_urls", [])
    image_b64s = payload.get("image_b64s", [])
    ref_image_urls = payload.get("reference_image_urls", [])
    if not image_urls and payload.get("image_url"):
        image_urls = [str(payload["image_url"]).strip()]
    if not image_b64s and payload.get("image_b64"):
        image_b64s = [str(payload["image_b64"]).strip()]
    image_urls = [str(u).strip() for u in image_urls if str(u).strip()]
    image_b64s = [str(b).strip() for b in image_b64s if str(b).strip()]
    ref_image_urls = [str(u).strip() for u in ref_image_urls if str(u).strip()][:4]
    resolution = str(payload.get("resolution", "720p")).strip() or "720p"
    video_model = str(payload.get("video_model", "")).strip()
    project_id = repository.create_quick_video_project(prompt, aspect_ratio)
    task_id = submit_project_task(
        project_id, "generate_quick_video",
        prompt=prompt, style=style, aspect_ratio=aspect_ratio,
        target_duration=target_duration,
        image_urls=image_urls, image_b64s=image_b64s,
        ref_image_urls=ref_image_urls,
        resolution=resolution, video_model=video_model,
    )
    return respond_json(start_response, {"task_id": task_id})


@register("GET", r"/api/generate-video/status")
def generate_video_status(environ, start_response):
    task_id = int(parse_qs_param(environ, "task_id", "0"))
    task = repository.get_task(task_id)
    if not task:
        return respond_json(start_response, {"error": "task not found"}, status="404 Not Found")
    result = {"status": task["status"]}
    if task["status"] == "succeeded" and task.get("output_url"):
        result["video_url"] = f'/assets/{task["output_url"]}'
    if task["status"] == "failed":
        result["error_message"] = task.get("error_message", "")
    return respond_json(start_response, result)


@register("GET", r"/api/generate-video/tasks")
def generate_video_tasks(environ, start_response):
    tasks = repository.list_quick_video_tasks()
    for t in tasks:
        if t["status"] == "succeeded" and t.get("output_url"):
            t["video_url"] = f'/assets/{t["output_url"]}'
    return respond_json(start_response, {"tasks": tasks})


@register("POST", r"/api/generate-image")
def generate_image(environ, start_response):
    import requests as _req
    payload = parse_json(environ)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return respond_json(start_response, {"error": "prompt is required"}, status="400 Bad Request")
    aspect_ratio = str(payload.get("aspect_ratio", "16:9")).strip() or "16:9"
    size_map = {"16:9": "2560x1440", "9:16": "1440x2560", "1:1": "2048x2048", "4:3": "2048x1536", "3:4": "1536x2048"}
    size = size_map.get(aspect_ratio, "2560x1440")
    cfg = load_config()
    api_body = {"model": cfg.image_model, "prompt": prompt, "size": size, "n": 1}
    ref_image = payload.get("reference_image")
    if ref_image:
        api_body["image"] = ref_image
    resp = _req.post(
        f"{cfg.api_base}/v1/images/generations",
        headers={"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"},
        json=api_body, timeout=120,
    )
    if resp.status_code != 200:
        return respond_json(start_response, {"error": resp.text[:200]}, status="500 Internal Server Error")
    data = resp.json()
    image_url = data["data"][0]["url"]
    return respond_json(start_response, {"image_url": image_url})
