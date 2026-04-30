from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor

from . import repository, services
from .pipeline import on_stage_complete


executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="video-lab")
atexit.register(executor.shutdown, wait=True)


def submit_project_task(project_id: int, task_type: str, shot_id: int | None = None, **kwargs) -> int:
    repository.fail_stale_tasks()

    if shot_id is not None and task_type in ("generate_shot_frames", "generate_shot_video"):
        existing = repository.list_project_tasks(project_id)
        for task in existing:
            if (
                task["shot_id"] == shot_id
                and task["task_type"] == task_type
                and task["status"] in ("queued", "running")
            ):
                return int(task["id"])

    task_id = repository.create_task(project_id=project_id, task_type=task_type, shot_id=shot_id, params=kwargs)
    executor.submit(_run_task, task_id, project_id, task_type, shot_id, kwargs)
    return task_id


def _heartbeat(task_id: int) -> None:
    repository.touch_task(task_id)


def _run_task(task_id: int, project_id: int, task_type: str, shot_id: int | None, kw: dict | None = None) -> None:
    kw = kw or {}
    repository.update_task(task_id, "running")
    try:
        if task_type == "pipeline":
            # Pipeline orchestrator — tasks are managed by pipeline.py
            pass
        elif task_type == "generate_story":
            _heartbeat(task_id)
            services.generate_story(project_id)
        elif task_type == "generate_screenplay":
            _heartbeat(task_id)
            services.generate_screenplay(project_id)
        elif task_type == "generate_beats":
            _heartbeat(task_id)
            services.generate_beats(project_id)
        elif task_type == "regenerate_from_stage":
            _heartbeat(task_id)
            services.regenerate_from_stage(project_id, kw.get("from_stage", "story"))
        elif task_type == "split_shots":
            _heartbeat(task_id)
            services.split_shots(project_id)
        elif task_type == "split_episode_shots":
            _heartbeat(task_id)
            services.split_episode_shots(int(kw["episode_id"]))
        elif task_type == "generate_all_frames":
            shots = repository.list_project_shots(project_id)
            for shot in shots:
                _heartbeat(task_id)
                services.generate_shot_frames(int(shot["id"]))
        elif task_type == "generate_episode_frames":
            _heartbeat(task_id)
            services.generate_episode_shot_frames(int(kw["episode_id"]))
        elif task_type == "generate_all_videos":
            shots = repository.list_project_shots(project_id)
            for shot in shots:
                _heartbeat(task_id)
                services.generate_shot_video(int(shot["id"]))
        elif task_type == "generate_episode_videos":
            _heartbeat(task_id)
            services.generate_episode_shot_videos(int(kw["episode_id"]))
        elif task_type == "generate_shot_frames" and shot_id is not None:
            _heartbeat(task_id)
            services.generate_shot_frames(shot_id)
        elif task_type == "generate_single_frame" and shot_id is not None:
            _heartbeat(task_id)
            services.generate_single_frame(shot_id, kw.get("frame_type", "start"))
        elif task_type == "generate_shot_video" and shot_id is not None:
            _heartbeat(task_id)
            services.generate_shot_video(shot_id)
        elif task_type == "generate_character_image":
            _heartbeat(task_id)
            services.generate_character_image(kw["char_id"])
        elif task_type == "generate_scene_image":
            _heartbeat(task_id)
            services.generate_scene_image(kw["scene_id"])
        elif task_type == "generate_characters":
            _heartbeat(task_id)
            services.generate_characters(project_id)
        elif task_type == "generate_episode_screenplay":
            _heartbeat(task_id)
            services.generate_episode_screenplay(int(kw["episode_id"]))
        elif task_type == "generate_scenes":
            _heartbeat(task_id)
            services.generate_scenes(project_id)
        elif task_type == "generate_quick_video":
            _heartbeat(task_id)
            video_path = services.generate_quick_video(
                task_id=task_id,
                prompt=kw.get("prompt", ""),
                style=kw.get("style", "cinematic"),
                aspect_ratio=kw.get("aspect_ratio", "16:9"),
                target_duration=int(kw.get("target_duration", 5)),
                image_urls=kw.get("image_urls", []),
                image_b64s=kw.get("image_b64s", []),
                ref_image_urls=kw.get("ref_image_urls", []),
                resolution=kw.get("resolution", "720p"),
                video_model=kw.get("video_model", ""),
            )
            repository.update_task_output(task_id, video_path)
        elif task_type == "seedance_t2v":
            _heartbeat(task_id)
            from .providers.seedance import SeedanceProvider
            from .config import load_seedance_config
            provider = SeedanceProvider(
                load_seedance_config(),
                on_progress=lambda step: repository.update_task_progress(task_id, step),
            )
            video_path = provider.generate_t2v(
                task_id=task_id,
                prompt=kw.get("prompt", ""),
                aspect_ratio=kw.get("aspect_ratio", "16:9"),
                resolution=kw.get("resolution", "720p"),
                duration=int(kw.get("duration", 5)),
                remove_watermark=kw.get("remove_watermark", False),
            )
            repository.update_task_output(task_id, video_path)
        elif task_type == "seedance_i2v":
            _heartbeat(task_id)
            from .providers.seedance import SeedanceProvider
            from .config import load_seedance_config
            provider = SeedanceProvider(
                load_seedance_config(),
                on_progress=lambda step: repository.update_task_progress(task_id, step),
            )
            video_path = provider.generate_i2v(
                task_id=task_id,
                prompt=kw.get("prompt", ""),
                images_list=kw.get("images_list", []),
                aspect_ratio=kw.get("aspect_ratio", "16:9"),
                resolution=kw.get("resolution", "720p"),
                duration=int(kw.get("duration", 5)),
                remove_watermark=kw.get("remove_watermark", False),
            )
            repository.update_task_output(task_id, video_path)
        elif task_type == "seedance_character":
            _heartbeat(task_id)
            from .providers.seedance import SeedanceProvider
            from .config import load_seedance_config
            provider = SeedanceProvider(
                load_seedance_config(),
                on_progress=lambda step: repository.update_task_progress(task_id, step),
            )
            image_path = provider.generate_character(
                task_id=task_id,
                images_list=kw.get("images_list", []),
                prompt=kw.get("prompt", ""),
                aspect_ratio=kw.get("aspect_ratio", "16:9"),
                resolution=kw.get("resolution", "720p"),
                duration=int(kw.get("duration", 5)),
                remove_watermark=kw.get("remove_watermark", False),
            )
            repository.update_task_output(task_id, image_path)
        elif task_type == "kling":
            _heartbeat(task_id)
            from .providers.kling import KlingProvider
            from .config import load_kling_config
            provider = KlingProvider(
                load_kling_config(),
                on_progress=lambda step: repository.update_task_progress(task_id, step),
            )
            method = kw.pop("method", "generate_image")
            result = getattr(provider, method)(task_id=task_id, **kw)
            repository.update_task_output(task_id, result)
        else:
            raise ValueError(f"Unsupported task type: {task_type}")
        repository.update_task(task_id, "succeeded")
        # Notify pipeline orchestrator if this is a child task
        task = repository.get_task(task_id)
        if task and task.get("parent_task_id"):
            on_stage_complete(task["parent_task_id"])
    except Exception as exc:
        repository.update_task(task_id, "failed", str(exc))
        # Also notify on failure so orchestrator can mark pipeline as failed
        task = repository.get_task(task_id)
        if task and task.get("parent_task_id"):
            on_stage_complete(task["parent_task_id"])
