from __future__ import annotations

from ..domain.generation import GenerationService
from . import parse_json, register, respond_json, serialize_task

generation_service = GenerationService()


@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate")
def submit_shot_generation(environ, start_response, shot_id: str):
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

