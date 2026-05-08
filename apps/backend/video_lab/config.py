from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, fields
from pathlib import Path

from . import repository
from .db import DATA_DIR

CONFIG_FILE = DATA_DIR / "config.json"
_PROMPTS_DIR = Path(__file__).parent / "prompts"

# ── Load prompts from .txt files ─────────────────────────────────
# Directory structure: prompts/{stage}/{role}.txt → key: prompt_{stage}_{role}
# e.g. prompts/story/system.txt → prompt_generate_story_system
#      prompts/shots/user.txt   → prompt_split_shots_user
_STAGE_KEY_MAP = {
    "story": "generate_story",
    "screenplay": "expand_story_screenplay",
    "beats": "expand_story_beats",
    "shots": "split_shots",
    "characters": "generate_characters",
    "scenes": "generate_scenes",
    "frame": "generate_frame",
    "video": "generate_video",
    "rewrite": "rewrite",
    "conversation": "conversation",
    "refine_outline": "refine_outline",
    "refine_character": "refine_character",
    "refine_scene": "refine_scene",
    "refine_screenplay": "refine_screenplay",
    "refine_beats": "refine_beats",
    "refine_shot": "refine_shot",
    "copilot_brief": "copilot_brief",
    "copilot_character": "copilot_character",
    "copilot_scene": "copilot_scene",
    "copilot_episode": "copilot_episode",
    "copilot_shot": "copilot_shot",
    "copilot_shot_prompt": "copilot_shot_prompt",
    "copilot_screenplay": "copilot_screenplay",
    "character_image": "character_image",
    "scene_image": "scene_image",
    "eval": "eval",
    "video_realism": "video_realism",
}


def _load_file_defaults() -> dict[str, str]:
    prompts: dict[str, str] = {}
    if not _PROMPTS_DIR.is_dir():
        return prompts
    for stage_dir in sorted(_PROMPTS_DIR.iterdir()):
        if not stage_dir.is_dir():
            continue
        stage = stage_dir.name
        key_prefix = _STAGE_KEY_MAP.get(stage)
        if not key_prefix:
            continue
        for txt_file in sorted(stage_dir.glob("*.txt")):
            role = txt_file.stem  # "system", "user", or "prompt"
            # For single-prompt stages (frame, video), file is named prompt.txt
            # and key should be prompt_{key_prefix} without extra suffix.
            if role == "prompt":
                prompt_key = f"prompt_{key_prefix}"
            else:
                prompt_key = f"prompt_{key_prefix}_{role}"
            prompts[prompt_key] = txt_file.read_text(encoding="utf-8").rstrip("\n")
    return prompts

# ── Vendor → models mapping ──────────────────────────────────────
VENDORS = {
    "OpenAI": {
        "text": [
            {"id": "gpt-5", "label": "GPT-5"},
            {"id": "gpt-5-mini", "label": "GPT-5 Mini"},
            {"id": "gpt-5-nano", "label": "GPT-5 Nano"},
            {"id": "gpt-5-p", "label": "GPT-5 P"},
            {"id": "gpt-5.1", "label": "GPT-5.1"},
            {"id": "gpt-5.2", "label": "GPT-5.2"},
            {"id": "gpt-5.2-codex", "label": "GPT-5.2 Codex"},
            {"id": "gpt-5.2-pro", "label": "GPT-5.2 Pro"},
            {"id": "gpt-5.3-chat-latest", "label": "GPT-5.3 Chat"},
            {"id": "gpt-5.3-codex", "label": "GPT-5.3 Codex"},
            {"id": "gpt-5.4", "label": "GPT-5.4"},
            {"id": "gpt-5.4-mini", "label": "GPT-5.4 Mini"},
            {"id": "gpt-5.4-nano", "label": "GPT-5.4 Nano"},
            {"id": "gpt-5.4-pro", "label": "GPT-5.4 Pro"},
            {"id": "o3", "label": "o3"},
            {"id": "o3-pro", "label": "o3 Pro"},
            {"id": "o4-mini", "label": "o4-mini"},
            {"id": "codex-mini-latest", "label": "Codex Mini"},
        ],
        "image": [
            {"id": "dall-e-3", "label": "DALL-E 3"},
            {"id": "gpt-image-1.5", "label": "GPT Image 1.5"},
            {"id": "chatgpt-image-latest", "label": "ChatGPT Image"},
        ],
        "video": [
            {"id": "sora-2", "label": "Sora 2"},
            {"id": "sora-2-pro", "label": "Sora 2 Pro"},
        ],
        "voice": [],
    },
    "Anthropic": {
        "text": [
            {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6"},
            {"id": "claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5"},
            {"id": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4"},
            {"id": "claude-opus-4-6", "label": "Claude Opus 4.6"},
            {"id": "claude-opus-4-5-20251101", "label": "Claude Opus 4.5"},
            {"id": "claude-opus-4-20250514", "label": "Claude Opus 4"},
            {"id": "claude-opus-4-1-20250805", "label": "Claude Opus 4.1"},
            {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "Google": {
        "text": [
            {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro"},
            {"id": "gemini-3.1-flash-lite-preview", "label": "Gemini 3.1 Flash Lite"},
            {"id": "gemini-3-pro", "label": "Gemini 3 Pro"},
            {"id": "gemini-3-pro-preview", "label": "Gemini 3 Pro Preview"},
            {"id": "gemini-3-flash-preview", "label": "Gemini 3 Flash"},
            {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
            {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
            {"id": "gemini-2.5-flash-lite", "label": "Gemini 2.5 Flash Lite"},
        ],
        "image": [
            {"id": "imagen-4.0-generate-001", "label": "Imagen 4"},
            {"id": "imagen-4.0-fast-generate-001", "label": "Imagen 4 Fast"},
            {"id": "imagen-4.0-ultra-generate-001", "label": "Imagen 4 Ultra"},
            {"id": "nano-banana", "label": "Nano Banana"},
            {"id": "nano-banana-2", "label": "Nano Banana 2"},
            {"id": "nano-banana-2_4k", "label": "Nano Banana 2 4K"},
            {"id": "nano-banana-pro", "label": "Nano Banana Pro"},
            {"id": "nano-banana-pro_4k", "label": "Nano Banana Pro 4K"},
            {"id": "nano-banana-f", "label": "Nano Banana F"},
            {"id": "gemini-2.5-flash-image", "label": "Gemini Flash Image"},
            {"id": "gemini-3-pro-image-preview", "label": "Gemini 3 Pro Image"},
            {"id": "gemini-3.1-flash-image-preview", "label": "Gemini 3.1 Flash Image"},
        ],
        "video": [
            {"id": "veo-3.1-generate-preview", "label": "Veo 3.1"},
            {"id": "veo-3.1-fast-generate-preview", "label": "Veo 3.1 Fast"},
            {"id": "veo-3.0-generate-001", "label": "Veo 3"},
            {"id": "veo-3.0-fast-generate-001", "label": "Veo 3 Fast"},
            {"id": "veo-2.0-generate-001", "label": "Veo 2"},
        ],
        "voice": [
            {"id": "gemini-2.5-flash-preview-tts", "label": "Gemini 2.5 Flash TTS"},
            {"id": "gemini-2.5-pro-preview-tts", "label": "Gemini 2.5 Pro TTS"},
        ],
    },
    "xAI": {
        "text": [
            {"id": "grok-4-0709", "label": "Grok 4"},
            {"id": "grok-4.20-beta", "label": "Grok 4.2 Beta"},
            {"id": "grok-4-1-fast", "label": "Grok 4.1 Fast"},
            {"id": "grok-3", "label": "Grok 3"},
            {"id": "grok-3-mini", "label": "Grok 3 Mini"},
            {"id": "grok-code-fast-1", "label": "Grok Code Fast"},
        ],
        "image": [
            {"id": "grok-imagine-image", "label": "Grok Imagine"},
            {"id": "grok-imagine-image-pro", "label": "Grok Imagine Pro"},
        ],
        "video": [
            {"id": "grok-imagine-video", "label": "Grok Imagine Video"},
        ],
        "voice": [
            {"id": "grok-tts", "label": "Grok TTS"},
        ],
    },
    "DeepSeek": {
        "text": [
            {"id": "deepseek-v4-pro", "label": "DeepSeek V4 Pro"},
            {"id": "deepseek-v4-flash", "label": "DeepSeek V4 Flash"},
            {"id": "deepseek-v3.2", "label": "DeepSeek V3.2"},
            {"id": "deepseek-v3.1", "label": "DeepSeek V3.1"},
            {"id": "deepseek-r1", "label": "DeepSeek R1"},
            {"id": "deepseek-r1-distill-qwen-32b", "label": "DeepSeek R1 Distill 32B"},
            {"id": "deepseek-r1-distill-qwen-14b", "label": "DeepSeek R1 Distill 14B"},
            {"id": "deepseek-r1-distill-qwen-7b", "label": "DeepSeek R1 Distill 7B"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "通义千问": {
        "text": [
            {"id": "qwen3.5-plus", "label": "Qwen 3.5 Plus"},
            {"id": "qwen3.5-flash", "label": "Qwen 3.5 Flash"},
            {"id": "qwen3.5-397b-a17b", "label": "Qwen 3.5 397B"},
            {"id": "qwen3.5-122b-a10b", "label": "Qwen 3.5 122B"},
            {"id": "qwen3.5-35b-a3b", "label": "Qwen 3.5 35B"},
            {"id": "qwen3.5-27b", "label": "Qwen 3.5 27B"},
            {"id": "qwen3-max", "label": "Qwen3 Max"},
            {"id": "qwen3-235b-a22b", "label": "Qwen3 235B"},
            {"id": "qwen3-32b", "label": "Qwen3 32B"},
            {"id": "qwen3-30b-a3b", "label": "Qwen3 30B"},
            {"id": "qwen3-14b", "label": "Qwen3 14B"},
            {"id": "qwen3-8b", "label": "Qwen3 8B"},
            {"id": "qwen3-4b", "label": "Qwen3 4B"},
            {"id": "qvq-max", "label": "QVQ Max"},
            {"id": "qvq-plus", "label": "QVQ Plus"},
            {"id": "qwq-plus", "label": "QwQ Plus"},
            {"id": "qwen3-coder-plus", "label": "Qwen3 Coder Plus"},
            {"id": "qwen3-coder-flash", "label": "Qwen3 Coder Flash"},
            {"id": "qwen3-coder-480b-a35b-instruct", "label": "Qwen3 Coder 480B"},
            {"id": "qwen3-coder-30b-a3b-instruct", "label": "Qwen3 Coder 30B"},
            {"id": "qwen-vl-ocr", "label": "Qwen VL OCR"},
            {"id": "qwen-omni-turbo", "label": "Qwen Omni Turbo"},
            {"id": "qwen-mt-plus", "label": "Qwen MT Plus"},
            {"id": "qwen-mt-flash", "label": "Qwen MT Flash"},
            {"id": "qwen3-vl-plus", "label": "Qwen3 VL Plus"},
            {"id": "qwen3-vl-flash", "label": "Qwen3 VL Flash"},
        ],
        "image": [
            {"id": "qwen-image-2.0", "label": "Qwen Image 2.0"},
            {"id": "qwen-image-2.0-pro", "label": "Qwen Image 2.0 Pro"},
            {"id": "qwen-image-edit-max", "label": "Qwen Image Edit Max"},
            {"id": "qwen-image-edit-plus", "label": "Qwen Image Edit Plus"},
        ],
        "video": [],
        "voice": [
            {"id": "qwen3-tts-instruct-flash", "label": "Qwen3 TTS Flash"},
            {"id": "qwen3-asr-flash", "label": "Qwen3 ASR Flash"},
            {"id": "qwen3-omni-flash", "label": "Qwen3 Omni Flash"},
        ],
    },
    "智谱 GLM": {
        "text": [
            {"id": "glm-5", "label": "GLM-5"},
            {"id": "glm-5-code", "label": "GLM-5 Code"},
            {"id": "glm-4.7", "label": "GLM-4.7"},
            {"id": "glm-4.7-flashx", "label": "GLM-4.7 Flash"},
            {"id": "glm-4.5-air", "label": "GLM-4.5 Air"},
            {"id": "glm-4-plus", "label": "GLM-4 Plus"},
            {"id": "glm-4-long", "label": "GLM-4 Long"},
            {"id": "glm-z1-flashx", "label": "GLM-Z1 Flash"},
            {"id": "glm-z1-airx", "label": "GLM-Z1 AirX"},
            {"id": "glm-z1-air", "label": "GLM-Z1 Air"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "Kimi": {
        "text": [
            {"id": "kimi-k2.5", "label": "Kimi K2.5"},
            {"id": "kimi-k2", "label": "Kimi K2"},
            {"id": "kimi-k2-thinking", "label": "Kimi K2 Thinking"},
            {"id": "kimi-k2-thinking-turbo", "label": "Kimi K2 Thinking Turbo"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "火山豆包": {
        "text": [
            {"id": "doubao-seed-2-0-pro-260215", "label": "豆包 Seed 2.0 Pro"},
            {"id": "doubao-seed-2-0-lite-260215", "label": "豆包 Seed 2.0 Lite"},
            {"id": "doubao-seed-2-0-mini-260215", "label": "豆包 Seed 2.0 Mini"},
            {"id": "doubao-seed-2-0-code-preview-260215", "label": "豆包 Seed 2.0 Code"},
            {"id": "doubao-seed-1-8-251228", "label": "豆包 Seed 1.8"},
            {"id": "doubao-seed-1-6-251015", "label": "豆包 Seed 1.6"},
            {"id": "doubao-seed-1-6-flash-250828", "label": "豆包 Seed 1.6 Flash"},
            {"id": "doubao-seed-1-6-lite-251015", "label": "豆包 Seed 1.6 Lite"},
            {"id": "doubao-seed-1-6-vision-250815", "label": "豆包 Seed 1.6 Vision"},
            {"id": "doubao-seed-code-preview-251028", "label": "豆包 Seed Code"},
            {"id": "doubao-seed-translation-250915", "label": "豆包 Seed 翻译"},
        ],
        "image": [
            {"id": "doubao-seedream-5-0-260128", "label": "即梦 5.0"},
            {"id": "doubao-seedream-4-5-251128", "label": "即梦 4.5"},
            {"id": "doubao-seedream-4-0-250828", "label": "即梦 4.0"},
            {"id": "doubao-seedream-3-0-t2i-250415", "label": "即梦 3.0"},
            {"id": "doubao-seededit-3-0-i2i-250628", "label": "即梦编辑 3.0"},
        ],
        "video": [
            {"id": "doubao-seedance-1-5-pro-251215", "label": "Seedance 1.5 Pro"},
            {"id": "doubao-seedance-1-5-pro-251215-f", "label": "Seedance 1.5 Pro (快)"},
            {"id": "doubao-seedance-1-0-pro-250528", "label": "Seedance 1.0 Pro"},
            {"id": "doubao-seedance-1-0-pro-250528-f", "label": "Seedance 1.0 Pro (快)"},
            {"id": "doubao-seedance-1-0-pro-fast-251015", "label": "Seedance 1.0 Pro Fast"},
            {"id": "doubao-seedance-1-0-pro-fast-251015-f", "label": "Seedance 1.0 Pro Fast (快)"},
            {"id": "doubao-seedance-1-0-lite-t2v-250428", "label": "Seedance 1.0 Lite 文生视频"},
            {"id": "doubao-seedance-1-0-lite-t2v-250428-f", "label": "Seedance 1.0 Lite 文生视频 (快)"},
            {"id": "doubao-seedance-1-0-lite-i2v-250428", "label": "Seedance 1.0 Lite 图生视频"},
            {"id": "doubao-seedance-1-0-lite-i2v-250428-f", "label": "Seedance 1.0 Lite 图生视频 (快)"},
        ],
        "voice": [],
    },
    "文心一言": {
        "text": [
            {"id": "ernie-5.0", "label": "ERNIE 5.0"},
            {"id": "ernie-4.5", "label": "ERNIE 4.5"},
            {"id": "ernie-4.5-turbo", "label": "ERNIE 4.5 Turbo"},
            {"id": "ernie-4.5-turbo-vl", "label": "ERNIE 4.5 Turbo VL"},
            {"id": "ernie-x1", "label": "ERNIE X1"},
            {"id": "ernie-x1-turbo", "label": "ERNIE X1 Turbo"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "讯飞星火": {
        "text": [
            {"id": "spark-4.0-ultra", "label": "星火 4.0 Ultra"},
            {"id": "spark-x2", "label": "星火 X2"},
            {"id": "spark-x1.5", "label": "星火 X1.5"},
            {"id": "spark-pro-128k", "label": "星火 Pro 128K"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "Mistral": {
        "text": [
            {"id": "mistral-large-latest", "label": "Mistral Large"},
            {"id": "mistral-medium-latest", "label": "Mistral Medium"},
            {"id": "mistral-small-latest", "label": "Mistral Small"},
            {"id": "magistral-medium-latest", "label": "Magistral Medium"},
            {"id": "magistral-small-latest", "label": "Magistral Small"},
            {"id": "devstral-medium-latest", "label": "Devstral Medium"},
            {"id": "devstral-small-latest", "label": "Devstral Small"},
            {"id": "codestral-latest", "label": "Codestral"},
            {"id": "ministral-14b-latest", "label": "Ministral 14B"},
            {"id": "ministral-8b-latest", "label": "Ministral 8B"},
            {"id": "voxtral-small-latest", "label": "Voxtral Small"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
    "MiniMax": {
        "text": [
            {"id": "MiniMax-M2.5", "label": "MiniMax M2.5"},
            {"id": "MiniMax-M2.1", "label": "MiniMax M2.1"},
            {"id": "MiniMax-M2.1-highspeed", "label": "MiniMax M2.1 高速"},
            {"id": "MiniMax-M2", "label": "MiniMax M2"},
        ],
        "image": [],
        "video": [
            {"id": "minimax-hailuo-2.3", "label": "海螺 2.3"},
            {"id": "minimax-hailuo-2.3-fast", "label": "海螺 2.3 Fast"},
            {"id": "minimax-hailuo-02", "label": "海螺 02"},
        ],
        "voice": [],
    },
    "可灵 Kling": {
        "text": [],
        "image": [
            {"id": "kling-image-o1", "label": "可灵图片 O1"},
            {"id": "kling-v2-image", "label": "可灵 V2 图片"},
            {"id": "kling-v1-image", "label": "可灵 V1 图片"},
        ],
        "video": [
            {"id": "kling-v3-omni", "label": "可灵 V3 Omni"},
            {"id": "kling-v3", "label": "可灵 V3"},
            {"id": "kling-v2-6", "label": "可灵 V2.6"},
            {"id": "kling-v2-5-turbo", "label": "可灵 V2.5 Turbo"},
            {"id": "kling-v2-master", "label": "可灵 V2 Master"},
            {"id": "kling-v2-1-master", "label": "可灵 V2.1 Master"},
            {"id": "kling-v2-1", "label": "可灵 V2.1"},
            {"id": "kling-v1-6", "label": "可灵 V1.6"},
            {"id": "kling-v1-5", "label": "可灵 V1.5"},
            {"id": "kling-v1", "label": "可灵 V1"},
            {"id": "kling-video-o1", "label": "可灵视频 O1"},
        ],
        "voice": [],
    },
    "Stability AI": {
        "text": [],
        "image": [
            {"id": "sd-3.5-large", "label": "SD 3.5 Large"},
            {"id": "sd-3.5-large-turbo", "label": "SD 3.5 Large Turbo"},
            {"id": "sd-3.5-medium", "label": "SD 3.5 Medium"},
            {"id": "sd-3.5-flash", "label": "SD 3.5 Flash"},
            {"id": "stable-image-ultra", "label": "Stable Image Ultra"},
            {"id": "stable-image-core", "label": "Stable Image Core"},
        ],
        "video": [],
        "voice": [],
    },
    "Flux": {
        "text": [],
        "image": [
            {"id": "flux-2-pro", "label": "Flux 2 Pro"},
            {"id": "flux-2-klein-9b", "label": "Flux 2 Klein 9B"},
            {"id": "flux-2-klein-4b", "label": "Flux 2 Klein 4B"},
            {"id": "flux-2-flex", "label": "Flux 2 Flex"},
            {"id": "flux-1.1-pro-ultra", "label": "Flux 1.1 Pro Ultra"},
            {"id": "flux-1.1-pro", "label": "Flux 1.1 Pro"},
            {"id": "flux-kontext-max", "label": "Flux Kontext Max"},
            {"id": "flux-kontext-pro", "label": "Flux Kontext Pro"},
        ],
        "video": [],
        "voice": [],
    },
    "Midjourney": {
        "text": [],
        "image": [
            {"id": "midjourney-v7", "label": "Midjourney V7"},
            {"id": "midjourney-v6", "label": "Midjourney V6"},
            {"id": "midjourney-niji", "label": "Midjourney Niji"},
        ],
        "video": [],
        "voice": [],
    },
    "Runway": {
        "text": [],
        "image": [
            {"id": "runway-gen4-image", "label": "Gen-4 Image"},
            {"id": "runway-gen4-image-turbo", "label": "Gen-4 Image Turbo"},
        ],
        "video": [
            {"id": "runway-gen4.5", "label": "Gen-4.5"},
            {"id": "runway-gen4-turbo", "label": "Gen-4 Turbo"},
            {"id": "runway-gen3a-turbo", "label": "Gen-3A Turbo"},
        ],
        "voice": [],
    },
    "Vidu": {
        "text": [],
        "image": [],
        "video": [
            {"id": "vidu-q3-pro", "label": "Vidu Q3 Pro"},
            {"id": "vidu-q3-turbo", "label": "Vidu Q3 Turbo"},
            {"id": "vidu-q2-pro", "label": "Vidu Q2 Pro"},
            {"id": "vidu-q2-pro-fast", "label": "Vidu Q2 Pro Fast"},
            {"id": "vidu-q2-turbo", "label": "Vidu Q2 Turbo"},
        ],
        "voice": [],
    },
    "PixVerse": {
        "text": [],
        "image": [],
        "video": [
            {"id": "pixverse-v5.6", "label": "PixVerse V5.6"},
            {"id": "pixverse-v5.5", "label": "PixVerse V5.5"},
            {"id": "pixverse-v5", "label": "PixVerse V5"},
            {"id": "pixverse-v4.5", "label": "PixVerse V4.5"},
        ],
        "voice": [],
    },
    "Luma": {
        "text": [
            {"id": "luma-photon", "label": "Luma Photon"},
            {"id": "luma-photon-flash", "label": "Luma Photon Flash"},
        ],
        "image": [],
        "video": [
            {"id": "luma-ray-2", "label": "Luma Ray 2"},
            {"id": "luma-ray-flash-2", "label": "Luma Ray Flash 2"},
        ],
        "voice": [],
    },
    "通义万相": {
        "text": [],
        "image": [
            {"id": "wan2.6-t2i", "label": "万相 2.6 文生图"},
            {"id": "wan2.6-image", "label": "万相 2.6 图片"},
            {"id": "wan2.5-t2i-preview", "label": "万相 2.5 文生图"},
            {"id": "wan2.5-i2i-preview", "label": "万相 2.5 图生图"},
        ],
        "video": [
            {"id": "wan2.6-t2v", "label": "万相 2.6 文生视频"},
            {"id": "wan2.6-i2v", "label": "万相 2.6 图生视频"},
            {"id": "wan2.6-i2v-flash", "label": "万相 2.6 图生视频 Flash"},
            {"id": "wan2.6-r2v", "label": "万相 2.6 R2V"},
            {"id": "wan2.6-r2v-flash", "label": "万相 2.6 R2V Flash"},
            {"id": "wan2.5-t2v-preview", "label": "万相 2.5 文生视频"},
            {"id": "wan2.5-i2v-preview", "label": "万相 2.5 图生视频"},
        ],
        "voice": [],
    },
    "ElevenLabs": {
        "text": [],
        "image": [],
        "video": [],
        "voice": [
            {"id": "elevenlabs-multilingual-v2", "label": "Multilingual V2"},
            {"id": "elevenlabs-flash", "label": "Flash"},
            {"id": "elevenlabs-scribe-v2", "label": "Scribe V2"},
            {"id": "elevenlabs-voice-changer", "label": "Voice Changer"},
            {"id": "elevenlabs-music", "label": "Music"},
            {"id": "elevenlabs-sound-effects", "label": "Sound Effects"},
        ],
    },
    "MiniMax 语音": {
        "text": [],
        "image": [],
        "video": [],
        "voice": [
            {"id": "speech-2.8-hd", "label": "Speech 2.8 HD"},
            {"id": "speech-2.8-turbo", "label": "Speech 2.8 Turbo"},
            {"id": "speech-2.6-hd", "label": "Speech 2.6 HD"},
            {"id": "speech-2.6-turbo", "label": "Speech 2.6 Turbo"},
            {"id": "speech-02-hd", "label": "Speech 02 HD"},
            {"id": "speech-02-turbo", "label": "Speech 02 Turbo"},
        ],
    },
    "CosyVoice": {
        "text": [],
        "image": [],
        "video": [],
        "voice": [
            {"id": "cosyvoice-v3.5-plus", "label": "CosyVoice V3.5 Plus"},
            {"id": "cosyvoice-v3.5-flash", "label": "CosyVoice V3.5 Flash"},
        ],
    },
    "Suno": {
        "text": [],
        "image": [],
        "video": [],
        "voice": [
            {"id": "suno-v5", "label": "Suno V5"},
            {"id": "suno-v4.5", "label": "Suno V4.5"},
            {"id": "music-2.5-plus", "label": "Music 2.5 Plus"},
            {"id": "music-2.5", "label": "Music 2.5"},
            {"id": "music-2.0", "label": "Music 2.0"},
        ],
    },
    "其他": {
        "text": [
            {"id": "image-01", "label": "Image-01"},
            {"id": "image-01-live", "label": "Image-01 Live"},
            {"id": "z-image-turbo", "label": "Z-Image Turbo"},
        ],
        "image": [],
        "video": [],
        "voice": [],
    },
}

# ── Default flat models (backward compat) ───────────────────────
DEFAULT_MODELS = {}
for cat in ("text", "image", "video", "voice"):
    seen = set()
    flat = []
    for vendor, cats in VENDORS.items():
        for m in cats.get(cat, []):
            if m["id"] not in seen:
                seen.add(m["id"])
                flat.append(m)
    DEFAULT_MODELS[cat] = flat


# ── Prompt templates ──────────────────────────────────────────
DEFAULT_PROMPTS = _load_file_defaults()

PROMPT_VARS = {
    "generate_story": ["title", "prompt", "style", "duration_seconds", "char_names", "scene_names"],
    "expand_story_screenplay": ["story", "style", "duration_seconds", "char_names", "scene_names"],
    "expand_story_beats": ["story", "style", "duration_seconds", "char_names", "scene_names"],
    "split_shots": ["story", "duration_seconds", "character_list", "scene_list"],
    "generate_characters": ["story", "style"],
    "generate_scenes": ["story", "style"],
    "generate_frame": ["frame_type", "frame_type_upper", "shot_prompt", "scene_description", "character_names", "reference_notes"],
    "generate_video": ["shot_title", "shot_prompt", "scene_description", "character_names", "continuity_notes", "narration_text", "sound_instruction"],
    "rewrite": ["original_story", "rewrite_direction", "style", "char_names", "scene_names"],
    "conversation": [],
}


def load_prompts() -> dict[str, str]:
    raw = _read_raw()
    result = dict(DEFAULT_PROMPTS)
    for k in DEFAULT_PROMPTS:
        if k in raw:
            result[k] = raw[k]
    return result


@dataclass(frozen=True)
class AppConfig:
    text_model: str = "gpt-5"
    image_model: str = "dall-e-3"
    video_model: str = "sora-2"
    voice_model: str = "none"
    api_key: str = ""
    api_base: str = "https://api.chatfire.site"
    max_tokens: int = 4096
    temperature: float = 0.7
    request_timeout: int = 300
    max_retries: int = 3
    poll_interval: int = 5


_FIELD_NAMES = {f.name for f in fields(AppConfig)}


def _read_raw() -> dict:
    """Read config from SQLite (primary) with config.json fallback."""
    # Layer 1: config.json (legacy, migration path)
    file_data = {}
    if CONFIG_FILE.exists():
        try:
            file_data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"[video_lab] Warning: failed to read config.json: {e}", file=sys.stderr)

    # Layer 2: SQLite settings (primary, overrides file)
    db_data = {}
    try:
        stored = repository.get_all_settings()
        for k, v in stored.items():
            try:
                db_data[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                db_data[k] = v
    except Exception:
        pass  # DB not ready yet (during init_db)

    # Merge: file as base, DB overrides
    merged = {**file_data, **db_data}
    return merged


def load_config() -> AppConfig:
    base = {}
    raw = _read_raw()
    base = {k: v for k, v in raw.items() if k in _FIELD_NAMES}

    # env overrides (highest priority)
    env_map = {
        "text_model": "VIDEO_LAB_TEXT_MODEL",
        "image_model": "VIDEO_LAB_IMAGE_MODEL",
        "video_model": "VIDEO_LAB_VIDEO_MODEL",
        "voice_model": "VIDEO_LAB_VOICE_MODEL",
        "api_key": "VIDEO_LAB_API_KEY",
        "api_base": "VIDEO_LAB_API_BASE",
        "max_tokens": "VIDEO_LAB_MAX_TOKENS",
        "temperature": "VIDEO_LAB_TEMPERATURE",
        "request_timeout": "VIDEO_LAB_REQUEST_TIMEOUT",
        "max_retries": "VIDEO_LAB_MAX_RETRIES",
        "poll_interval": "VIDEO_LAB_POLL_INTERVAL",
    }
    for field_name, env_name in env_map.items():
        val = os.environ.get(env_name)
        if val is not None:
            base[field_name] = val

    return _coerce(base)


def load_models() -> dict[str, list[dict]]:
    raw = _read_raw()
    saved = raw.get("models")
    if saved and isinstance(saved, dict):
        merged = {}
        for cat in ("text", "image", "video", "voice"):
            default_list = DEFAULT_MODELS.get(cat, [])
            saved_list = saved.get(cat, [])
            merged[cat] = saved_list if saved_list else default_list
        return merged
    return dict(DEFAULT_MODELS)


def load_vendors() -> dict:
    return VENDORS


def save_all(data: dict) -> None:
    """Save config + models to SQLite."""
    # Save config fields
    settings_to_save = {}
    for k, v in data.items():
        if k == "models":
            settings_to_save["models"] = json.dumps(v, ensure_ascii=False)
        elif k in _FIELD_NAMES:
            settings_to_save[k] = json.dumps(v)

    if settings_to_save:
        try:
            repository.set_settings(settings_to_save)
        except Exception as e:
            print(f"[video_lab] Warning: failed to save settings to DB: {e}", file=sys.stderr)

    # Also write config.json for backward compatibility
    _write_config_json(data)


def save_models_only(models: dict[str, list[dict]]) -> None:
    try:
        repository.set_setting("models", json.dumps(models, ensure_ascii=False))
    except Exception as e:
        print(f"[video_lab] Warning: failed to save models to DB: {e}", file=sys.stderr)
    # Also write config.json for backward compatibility
    _write_config_json({"models": models})


def _write_config_json(data: dict) -> None:
    """Write to config.json for backward compatibility."""
    raw = {}
    if CONFIG_FILE.exists():
        try:
            raw = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    raw.update(data)
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")


def _coerce(raw: dict) -> AppConfig:
    int_fields = {"max_tokens", "request_timeout", "max_retries", "poll_interval"}
    float_fields = {"temperature"}
    coerced = {}
    for f in fields(AppConfig):
        name = f.name
        val = raw.get(name, f.default)
        if name in int_fields:
            try:
                val = int(val)
            except (ValueError, TypeError):
                val = f.default
        elif name in float_fields:
            try:
                val = float(val)
            except (ValueError, TypeError):
                val = f.default
        coerced[name] = val
    return AppConfig(**coerced)


# ---------------------------------------------------------------------------
# Seedance 2.0 独立配置
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SeedanceConfig:
    seedance_api_base: str = "https://ark.cn-beijing.volces.com/api/plan/v3"
    seedance_api_key: str = ""


_SEEDANCE_FIELD_NAMES = {f.name for f in fields(SeedanceConfig)}


def load_seedance_config() -> SeedanceConfig:
    raw = _read_raw()
    base = {k: v for k, v in raw.items() if k in _SEEDANCE_FIELD_NAMES}
    return SeedanceConfig(**base)


def save_seedance_config(data: dict) -> None:
    settings = {}
    for k, v in data.items():
        if k in _SEEDANCE_FIELD_NAMES:
            settings[k] = v if isinstance(v, str) else json.dumps(v)
    if settings:
        try:
            repository.set_settings(settings)
        except Exception as e:
            print(f"[video_lab] Warning: failed to save seedance config: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Kling 可灵 独立配置
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class KlingConfig:
    kling_api_base: str = "https://api-beijing.klingai.com"
    kling_access_key: str = ""
    kling_secret_key: str = ""


_KLING_FIELD_NAMES = {f.name for f in fields(KlingConfig)}


def load_kling_config() -> KlingConfig:
    raw = _read_raw()
    base = {k: v for k, v in raw.items() if k in _KLING_FIELD_NAMES}
    return KlingConfig(**base)


def save_kling_config(data: dict) -> None:
    settings = {}
    for k, v in data.items():
        if k in _KLING_FIELD_NAMES:
            settings[k] = v if isinstance(v, str) else json.dumps(v)
    if settings:
        try:
            repository.set_settings(settings)
        except Exception as e:
            print(f"[video_lab] Warning: failed to save kling config: {e}", file=sys.stderr)
