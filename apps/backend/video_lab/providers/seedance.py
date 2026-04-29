"""Seedance 2.0 provider via Volcano Engine Ark."""

from __future__ import annotations

import base64
import time
from collections.abc import Callable

import requests

from ..config import SeedanceConfig
from ..db import ASSETS_DIR
from .utils import download_asset

# Default model IDs
DEFAULT_MODEL = "doubao-seedance-2-0-260128"

TASKS_PATH = "/contents/generations/tasks"


class SeedanceProvider:
    def __init__(self, config: SeedanceConfig, on_progress: Callable[[str], None] | None = None):
        self._config = config
        self._base_url = config.seedance_api_base.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {config.seedance_api_key}",
            "Content-Type": "application/json",
        }
        self._on_progress = on_progress or (lambda _s: None)

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        url = f"{self._base_url}{path}"
        resp = requests.request(method, url, headers=self._headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _poll_result(self, ark_task_id: str, timeout: int = 600) -> dict:
        poll_url = f"{TASKS_PATH}/{ark_task_id}"
        interval = 10
        max_polls = timeout // interval
        self._on_progress("等待云端生成")
        for i in range(max(max_polls, 1)):
            time.sleep(interval)
            data = self._request("GET", poll_url)
            status = data.get("status", "")
            if status == "succeeded":
                return data
            if status == "failed":
                err = data.get("error") or data.get("message") or "Unknown error"
                raise RuntimeError(f"Seedance generation failed: {err}")
            # queued / running — update progress periodically
            waited = (i + 1) * interval
            if waited % 30 == 0:
                self._on_progress(f"生成中 (已等待 {waited}s)")
        raise RuntimeError(f"Seedance generation timed out after {timeout}s")

    @staticmethod
    def _normalize_image(img: str) -> str:
        """Return a value suitable for image_url.url."""
        if img.startswith("http"):
            return img
        if img.startswith("data:"):
            return img
        # Local asset file — encode to base64
        img_path = ASSETS_DIR / img
        if img_path.exists():
            b64 = base64.b64encode(img_path.read_bytes()).decode()
            return f"data:image/png;base64,{b64}"
        return img

    def generate_t2v(self, task_id: int, prompt: str, aspect_ratio: str = "16:9",
                      resolution: str = "720p", duration: int = 5,
                      remove_watermark: bool = False, **_extra) -> str:
        content = []
        if prompt.strip():
            content.append({"type": "text", "text": prompt.strip()})

        payload = {
            "model": DEFAULT_MODEL,
            "content": content,
            "ratio": aspect_ratio,
            "resolution": resolution,
            "duration": duration,
            "watermark": remove_watermark,
        }
        self._on_progress("提交生成请求")
        result = self._request("POST", TASKS_PATH, payload)
        ark_task_id = result.get("id")
        if not ark_task_id:
            raise RuntimeError(f"T2V did not return task id: {result}")

        final = self._poll_result(ark_task_id)
        self._on_progress("下载视频")
        video_url = (final.get("content") or {}).get("video_url", "") or final.get("video_url", "")
        if not video_url:
            raise RuntimeError(f"T2V completed but no video URL: {final}")
        filename = f"seedance_{task_id}_video.mp4"
        return download_asset(video_url, filename, ASSETS_DIR)

    def generate_i2v(self, task_id: int, prompt: str, images_list: list[str],
                      aspect_ratio: str = "16:9", resolution: str = "720p",
                      duration: int = 5, remove_watermark: bool = False,
                      **_extra) -> str:
        content = []
        if prompt.strip():
            content.append({"type": "text", "text": prompt.strip()})
        for img in images_list:
            content.append({
                "type": "image_url",
                "image_url": {"url": self._normalize_image(img)},
                "role": "first_frame",
            })

        payload = {
            "model": DEFAULT_MODEL,
            "content": content,
            "ratio": aspect_ratio,
            "resolution": resolution,
            "duration": duration,
            "watermark": remove_watermark,
        }
        self._on_progress("提交生成请求")
        result = self._request("POST", TASKS_PATH, payload)
        ark_task_id = result.get("id")
        if not ark_task_id:
            raise RuntimeError(f"I2V did not return task id: {result}")

        final = self._poll_result(ark_task_id)
        self._on_progress("下载视频")
        video_url = (final.get("content") or {}).get("video_url", "") or final.get("video_url", "")
        if not video_url:
            raise RuntimeError(f"I2V completed but no video URL: {final}")
        filename = f"seedance_{task_id}_video.mp4"
        return download_asset(video_url, filename, ASSETS_DIR)

    def generate_character(self, task_id: int, images_list: list[str], prompt: str,
                            aspect_ratio: str = "9:16", resolution: str = "480p",
                            duration: int = 5, remove_watermark: bool = False,
                            **_extra) -> str:
        content = []
        if prompt.strip():
            content.append({"type": "text", "text": prompt.strip()})
        for img in images_list:
            content.append({
                "type": "image_url",
                "image_url": {"url": self._normalize_image(img)},
                "role": "reference_image",
            })

        payload = {
            "model": DEFAULT_MODEL,
            "content": content,
            "ratio": aspect_ratio,
            "resolution": resolution,
            "duration": duration,
            "watermark": remove_watermark,
        }
        self._on_progress("提交生成请求")
        result = self._request("POST", TASKS_PATH, payload)
        ark_task_id = result.get("id")
        if not ark_task_id:
            raise RuntimeError(f"Character did not return task id: {result}")

        final = self._poll_result(ark_task_id)
        self._on_progress("下载结果")
        video_url = (final.get("content") or {}).get("video_url", "") or final.get("video_url", "")
        if not video_url:
            raise RuntimeError(f"Character completed but no output URL: {final}")
        filename = f"seedance_{task_id}_video.mp4"
        return download_asset(video_url, filename, ASSETS_DIR)
