"""Kling (可灵) provider via direct API with JWT auth."""

from __future__ import annotations

import base64
import time
from collections.abc import Callable

import jwt
import requests

from ..config import KlingConfig, load_prompts
from ..db import ASSETS_DIR
from .utils import download_asset


class KlingProvider:
    def __init__(self, config: KlingConfig, on_progress: Callable[[str], None] | None = None):
        self._config = config
        self._base_url = config.kling_api_base.rstrip("/")
        self._on_progress = on_progress or (lambda _s: None)

    def _make_jwt(self) -> str:
        now = int(time.time())
        payload = {
            "iss": self._config.kling_access_key,
            "exp": now + 1800,
            "nbf": now - 5,
        }
        return jwt.encode(payload, self._config.kling_secret_key, algorithm="HS256")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._make_jwt()}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        url = f"{self._base_url}{path}"
        resp = requests.request(method, url, headers=self._headers(), json=payload, timeout=30, proxies={"http": None, "https": None})
        if not resp.ok:
            try:
                err_body = resp.json()
                raise requests.HTTPError(f"{resp.status_code} {resp.reason}: {err_body}", response=resp)
            except ValueError:
                raise requests.HTTPError(f"{resp.status_code} {resp.reason}: {resp.text[:500]}", response=resp)
        return resp.json()

    def _poll_video(self, task_id: str, api_path: str, timeout: int = 600) -> dict:
        interval = 10
        max_polls = timeout // interval
        self._on_progress("等待云端生成")
        for i in range(max(max_polls, 1)):
            time.sleep(interval)
            data = self._request("GET", f"{api_path}/{task_id}")
            task_data = data.get("data", data)
            status = task_data.get("task_status", "")
            if status == "succeed":
                return task_data
            if status == "failed":
                err = task_data.get("task_status_msg") or "Unknown error"
                raise RuntimeError(f"Kling generation failed: {err}")
            waited = (i + 1) * interval
            if waited % 30 == 0:
                self._on_progress(f"生成中 (已等待 {waited}s)")
        raise RuntimeError(f"Kling generation timed out after {timeout}s")

    @staticmethod
    def _normalize_image(img: str) -> str:
        """Return a base64 or URL string suitable for the API."""
        if img.startswith("http"):
            # Local URLs can't be accessed by Kling cloud — download and convert
            if "127.0.0.1" in img or "localhost" in img:
                try:
                    resp = requests.get(img, timeout=30, proxies={"http": None, "https": None})
                    resp.raise_for_status()
                    return base64.b64encode(resp.content).decode()
                except Exception:
                    pass
            return img
        if img.startswith("data:"):
            return img.split(",", 1)[1]
        if len(img) > 500:
            return img
        img_path = ASSETS_DIR / img
        try:
            if img_path.exists():
                return base64.b64encode(img_path.read_bytes()).decode()
        except OSError:
            pass
        return img

    def _get_handler(self, model_name: str):
        from .handlers import get_handler
        return get_handler(model_name, self)

    def _run_handler(self, handler, task_id: int, filename_prefix: str, **params) -> str:
        self._on_progress("提交生成请求")
        submit_result = handler.submit(**params)
        api_task_id = submit_result.get("data", {}).get("task_id") or submit_result.get("task_id")
        if not api_task_id:
            raise RuntimeError(f"Submit did not return task id: {submit_result}")
        final = handler.poll(str(api_task_id))
        url = handler.extract(final)
        ext = "mp4" if handler.asset_type() == "video" else "png"
        self._on_progress("下载" + ("视频" if handler.asset_type() == "video" else "图片"))
        filename = f"{filename_prefix}_{task_id}_{'video' if handler.asset_type() == 'video' else 'image'}.{ext}"
        return download_asset(url, filename, ASSETS_DIR)

    def generate_t2v(self, task_id: int, prompt: str, model_name: str = "kling-v1",
                      aspect_ratio: str = "16:9", duration: str = "5",
                      mode: str = "std", negative_prompt: str = "",
                      sound: str = "", **_extra) -> str:
        handler = self._get_handler(model_name)
        if handler and handler.asset_type() == "video":
            return self._run_handler(handler, task_id, "kling",
                prompt=prompt, aspect_ratio=aspect_ratio, duration=duration,
                mode=mode, negative_prompt=negative_prompt, sound=sound)
        # Fallback: direct API call
        payload = {
            "model_name": model_name, "prompt": prompt,
            "aspect_ratio": aspect_ratio, "duration": str(duration), "mode": mode,
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if sound:
            payload["sound"] = sound if sound in ("on", "off") else ("on" if sound else "off")
        self._on_progress("提交生成请求")
        data = self._request("POST", "/v1/videos/text2video", payload)
        api_task_id = data.get("data", {}).get("task_id")
        if not api_task_id:
            raise RuntimeError(f"T2V did not return task id: {data}")
        final = self._poll_video(api_task_id, "/v1/videos/text2video")
        self._on_progress("下载视频")
        videos = final.get("task_result", {}).get("videos", [])
        if not videos:
            raise RuntimeError(f"T2V completed but no video URL: {final}")
        return download_asset(videos[0]["url"], f"kling_{task_id}_video.mp4", ASSETS_DIR)

    def generate_i2v(self, task_id: int, prompt: str, model_name: str = "kling-v1",
                      image: str = "", image_tail: str = "",
                      aspect_ratio: str = "16:9", duration: str = "5",
                      mode: str = "std", negative_prompt: str = "",
                      sound: str = "", **_extra) -> str:
        handler = self._get_handler(model_name)
        if handler and handler.asset_type() == "video":
            return self._run_handler(handler, task_id, "kling",
                prompt=prompt, image=image, image_tail=image_tail,
                aspect_ratio=aspect_ratio, duration=duration,
                mode=mode, negative_prompt=negative_prompt, sound=sound)
        # Fallback
        payload = {
            "model_name": model_name, "prompt": prompt,
            "aspect_ratio": aspect_ratio, "duration": str(duration), "mode": mode,
        }
        if image:
            payload["image"] = self._normalize_image(image)
        if image_tail:
            payload["image_tail"] = self._normalize_image(image_tail)
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if sound:
            payload["sound"] = sound if sound in ("on", "off") else ("on" if sound else "off")
        self._on_progress("提交生成请求")
        data = self._request("POST", "/v1/videos/image2video", payload)
        api_task_id = data.get("data", {}).get("task_id")
        if not api_task_id:
            raise RuntimeError(f"I2V did not return task id: {data}")
        final = self._poll_video(api_task_id, "/v1/videos/image2video")
        self._on_progress("下载视频")
        videos = final.get("task_result", {}).get("videos", [])
        if not videos:
            raise RuntimeError(f"I2V completed but no video URL: {final}")
        return download_asset(videos[0]["url"], f"kling_{task_id}_video.mp4", ASSETS_DIR)

    def generate_omni_image(self, task_id: int, prompt: str,
                              image_list: list[str] | None = None,
                              model_name: str = "kling-image-o1",
                              aspect_ratio: str = "16:9",
                              resolution: str = "1k",
                              n: int = 1,
                              negative_prompt: str = "", **_extra) -> str:
        handler = self._get_handler(model_name)
        if handler and handler.asset_type() == "image":
            return self._run_handler(handler, task_id, "kling",
                prompt=prompt, image_list=image_list or [],
                aspect_ratio=aspect_ratio, resolution=resolution,
                n=n, negative_prompt=negative_prompt)
        # Fallback
        payload = {
            "model_name": model_name, "prompt": prompt,
            "aspect_ratio": aspect_ratio, "resolution": resolution,
            "n": n, "watermark_info": {"enabled": False},
        }
        if image_list:
            payload["image_list"] = [{"image": self._normalize_image(img)} for img in image_list if img]
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        self._on_progress("提交 Omni 图片生成请求")
        data = self._request("POST", "/v1/images/omni-image", payload)
        api_task_id = data.get("data", {}).get("task_id")
        if not api_task_id:
            raise RuntimeError(f"Omni image did not return task id: {data}")
        final = self._poll_video(api_task_id, "/v1/images/omni-image")
        self._on_progress("下载图片")
        images = final.get("task_result", {}).get("images", [])
        if not images:
            raise RuntimeError(f"Omni image completed but no images: {final}")
        return download_asset(images[0]["url"], f"kling_{task_id}_omni.png", ASSETS_DIR)

    def generate_omni_video(self, task_id: int, prompt: str,
                              image_list: list | None = None,
                              model_name: str = "kling-video-o1",
                              aspect_ratio: str = "16:9",
                              duration: str = "5",
                              mode: str = "std", **_extra) -> str:
        handler = self._get_handler(model_name)
        if handler and handler.asset_type() == "video":
            return self._run_handler(handler, task_id, "kling",
                prompt=prompt, image_list=image_list or [],
                aspect_ratio=aspect_ratio, duration=duration, mode=mode)
        # Fallback
        payload = {
            "model_name": model_name, "prompt": prompt,
            "aspect_ratio": aspect_ratio, "duration": duration, "mode": mode,
        }
        if image_list:
            payload["image_list"] = [
                {"image_url": self._normalize_image(img)}
                if isinstance(img, str)
                else {**img, "image_url": self._normalize_image(img.get("image_url", img.get("image", "")))}
                for img in image_list
                if (isinstance(img, str) and img) or (isinstance(img, dict) and (img.get("image_url") or img.get("image")))
            ]
        self._on_progress("提交 Omni 视频生成请求")
        data = self._request("POST", "/v1/videos/omni-video", payload)
        api_task_id = data.get("data", {}).get("task_id")
        if not api_task_id:
            raise RuntimeError(f"Omni video did not return task id: {data}")
        final = self._poll_video(api_task_id, "/v1/videos/omni-video")
        self._on_progress("下载视频")
        videos = final.get("task_result", {}).get("videos", [])
        if not videos:
            raise RuntimeError(f"Omni video completed but no videos: {final}")
        return download_asset(videos[0]["url"], f"kling_{task_id}_video.mp4", ASSETS_DIR)

    def generate_image(self, task_id: int, prompt: str, model_name: str = "kling-v1",
                        aspect_ratio: str = "16:9", n: int = 1,
                        negative_prompt: str = "", **_extra) -> str:
        handler = self._get_handler(model_name)
        if handler and handler.asset_type() == "image":
            return self._run_handler(handler, task_id, "kling",
                prompt=prompt, aspect_ratio=aspect_ratio, n=n,
                negative_prompt=negative_prompt)
        # Fallback
        payload = {
            "model_name": model_name, "prompt": prompt,
            "aspect_ratio": aspect_ratio, "n": n,
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        self._on_progress("提交图片生成请求")
        data = self._request("POST", "/v1/images/generations", payload)
        api_task_id = data.get("data", {}).get("task_id")
        if not api_task_id:
            raise RuntimeError(f"Image generation did not return task id: {data}")
        final = self._poll_video(api_task_id, "/v1/images/generations")
        self._on_progress("下载图片")
        images = final.get("task_result", {}).get("images", [])
        if not images:
            raise RuntimeError(f"Image generation completed but no images: {final}")
        return download_asset(images[0]["url"], f"kling_{task_id}_image.png", ASSETS_DIR)

    def generate_character_image(self, char_id: int, appearance_prompt: str, style: str) -> str:
        prompts = load_prompts()
        template = prompts.get("prompt_character_image", "")
        prompt = template.format(style=style, appearance_prompt=appearance_prompt) if template else appearance_prompt
        print(f"[PROMPT_DEBUG] provider=kling model=kling-v2-1 action=character_image char_id={char_id} final_prompt={prompt!r}")
        return self.generate_image(task_id=char_id, prompt=prompt, model_name="kling-v2-1")

    def generate_scene_image(self, scene_id: int, description: str, style: str) -> str:
        prompts = load_prompts()
        template = prompts.get("prompt_scene_image", "")
        prompt = template.format(style=style, description=description) if template else description
        print(f"[PROMPT_DEBUG] provider=kling model=kling-v2-1 action=scene_image scene_id={scene_id} final_prompt={prompt!r}")
        return self.generate_image(task_id=scene_id, prompt=prompt, model_name="kling-v2-1")

    def generate_video(self, shot_id, shot_title, shot_prompt, start_frame_path="",
                       end_frame_path="", aspect_ratio="16:9", duration=8,
                       resolution="720p", **kwargs) -> str:
        if start_frame_path:
            return self.generate_i2v(
                task_id=shot_id, prompt=shot_prompt,
                image=start_frame_path, image_tail=end_frame_path or "",
                aspect_ratio=aspect_ratio, duration=str(duration), mode="std")
        return self.generate_t2v(
            task_id=shot_id, prompt=shot_prompt,
            aspect_ratio=aspect_ratio, duration=str(duration), mode="std")
