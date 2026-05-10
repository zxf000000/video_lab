from __future__ import annotations

import base64
import io
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import requests as _req

from ..config import load_config, load_prompts, load_seedance_config
from ..db import ASSETS_DIR
from ..domain.assets import AssetsService
from ..domain.generation import GenerationService
from ..domain.prompts import PromptsService
from ..domain.shots import ShotsService
from ..providers.chatfire import ChatfireProvider
from . import parse_json, register, respond_json, serialize_prompt, serialize_task

prompts_service = PromptsService()
shots_service = ShotsService()
assets_service = AssetsService()


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


START_MARKER = "===PROPOSAL==="
END_MARKER = "===END_PROPOSAL==="


def _extract_shot_prompt_proposal(text: str) -> dict | None:
    if START_MARKER not in text or END_MARKER not in text:
        return None
    start = text.index(START_MARKER) + len(START_MARKER)
    end = text.index(END_MARKER, start)
    raw = text[start:end].strip()
    try:
        proposal = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(proposal, dict):
        return None
    first_frame_prompt = str(proposal.get("first_frame_prompt", "")).strip()
    first_frame_negative_prompt = str(proposal.get("first_frame_negative_prompt", "")).strip()
    video_prompt = str(proposal.get("video_prompt", "")).strip()
    video_negative_prompt = str(proposal.get("video_negative_prompt", "")).strip()
    negative_prompt = str(proposal.get("negative_prompt", "")).strip()
    try:
        duration_seconds = int(proposal.get("duration_seconds", 0))
    except (ValueError, TypeError):
        duration_seconds = 0
    duration_seconds = max(2, min(8, duration_seconds)) if duration_seconds else 0
    # Fallback: support old single prompt_text format
    if not first_frame_prompt:
        prompt_text = str(proposal.get("prompt_text", "")).strip()
        if prompt_text:
            first_frame_prompt = prompt_text
    if not first_frame_prompt:
        return None
    return {
        "first_frame_prompt": first_frame_prompt,
        "first_frame_negative_prompt": first_frame_negative_prompt,
        "video_prompt": video_prompt,
        "video_negative_prompt": video_negative_prompt,
        "negative_prompt": negative_prompt,
        "duration_seconds": duration_seconds,
    }


_ORDINAL_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]

MOTION_NEGATIVE_KEYWORDS: dict[str, str] = {
    "固定": "镜头晃动, 画面抖动, camera shake, jitter",
    "推": "画面静止, 镜头跳跃, 卡顿, static frame, stutter",
    "拉": "画面静止, 镜头跳跃, 卡顿, static frame, stutter",
    "摇": "画面静止, 镜头跳跃, 跳帧, static frame, stutter",
    "移": "画面静止, 镜头不稳, 脱靶, static frame, unstable",
    "跟": "画面静止, 镜头脱靶, 失焦, static frame, tracking loss",
    "升": "画面静止, 镜头跳跃, 卡顿, static frame, stutter",
    "降": "画面静止, 镜头跳跃, 卡顿, static frame, stutter",
    "甩": "画面撕裂, 拖影, 模糊, motion blur, ghosting",
    "旋转": "画面变形, 畸变, 不稳, distortion, unstable",
}


def _inject_motion_negative(video_negative: str, camera_motion: str) -> str:
    """Append motion-specific negative keywords based on camera movement type."""
    if not camera_motion:
        return video_negative
    for motion_type, keywords in MOTION_NEGATIVE_KEYWORDS.items():
        if motion_type in camera_motion:
            existing = set(video_negative.replace(",", " ").replace("，", " ").split())
            to_add = [kw.strip() for kw in keywords.split(",") if kw.strip() not in existing]
            if to_add:
                return f"{video_negative}, {', '.join(to_add)}" if video_negative else ", ".join(to_add)
            break
    return video_negative


def _ordinal_label(index: int) -> str:
    if 1 <= index <= len(_ORDINAL_LABELS):
        return f"图{_ORDINAL_LABELS[index - 1]}"
    return f"图{index}"


@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate-prompt")
def generate_shot_prompt(environ, start_response, shot_id: str):
    try:
        shot = shots_service.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    # Collect image references: characters first, then scene
    image_refs = []  # list of {"label": "图一", "type": "character"/"scene", "name": ..., "path": ...}
    image_reference_lines = []  # for prompt template

    # Character images
    character_context = "无关联角色"
    character_ids_raw = shot.get("character_ids", "[]")
    if isinstance(character_ids_raw, str):
        try:
            character_ids = json.loads(character_ids_raw)
        except (json.JSONDecodeError, TypeError):
            character_ids = []
    elif isinstance(character_ids_raw, list):
        character_ids = character_ids_raw
    else:
        character_ids = []

    idx = 0
    char_descriptions = []
    appearance_anchor = ""
    if character_ids:
        for cid in character_ids[:5]:
            try:
                char = assets_service.get_character(int(cid))
                if char:
                    idx += 1
                    label = _ordinal_label(idx)
                    name = char.get("name", "角色")
                    image_path = char.get("image_path", "")
                    if not appearance_anchor and char.get("appearance_prompt", "").strip():
                        appearance_anchor = char["appearance_prompt"].strip()
                    image_refs.append({"label": label, "type": "character", "name": name, "path": image_path})
                    image_reference_lines.append(f"{label} = {name} (角色图片)")
                    parts = [f"角色名: {name}"]
                    if char.get("appearance_summary"):
                        parts.append(f"外观: {char['appearance_summary']}")
                    if char.get("appearance_prompt"):
                        parts.append(f"外观提示词: {char['appearance_prompt']}")
                    if char.get("speech_style"):
                        parts.append(f"说话风格与音色: {char['speech_style']}")
                    if char.get("personality_tags"):
                        tags = char["personality_tags"]
                        if isinstance(tags, str):
                            try:
                                tags = json.loads(tags)
                            except (json.JSONDecodeError, TypeError):
                                tags = []
                        if isinstance(tags, list):
                            parts.append(f"性格标签: {', '.join(tags)}")
                    if image_path:
                        parts.append(f"角色图片路径: /assets/{image_path}")
                    char_descriptions.append(" | ".join(parts))
            except Exception:
                continue
    if char_descriptions:
        character_context = "\n".join(char_descriptions)

    appearance_anchor_section = ""
    if appearance_anchor:
        appearance_anchor_section = f"## 角色外貌锚定词（必须逐字复制，不得改写）\n{appearance_anchor}"

    # Scene image
    scene_context = "无关联场景"
    scene_preset_id = shot.get("scene_preset_id")
    if scene_preset_id:
        try:
            scene = assets_service.get_scene_preset(int(scene_preset_id))
            if scene:
                idx += 1
                scene_label = _ordinal_label(idx)
                scene_name = scene.get("name", "场景")
                # Get first variant image path
                scene_image_path = ""
                variants = scene.get("variants", "[]")
                if isinstance(variants, str):
                    try:
                        variants = json.loads(variants)
                    except (json.JSONDecodeError, TypeError):
                        variants = []
                if isinstance(variants, list) and variants:
                    for v in variants:
                        if isinstance(v, dict) and v.get("imagePath"):
                            scene_image_path = v["imagePath"]
                            break
                image_refs.append({"label": scene_label, "type": "scene", "name": scene_name, "path": scene_image_path})
                image_reference_lines.append(f"{scene_label} = {scene_name} (场景图片)")

                scene_parts = [f"场景名称: {scene_name}"]
                if scene.get("space_description"):
                    scene_parts.append(f"空间描述: {scene['space_description']}")
                if scene.get("lighting_style"):
                    scene_parts.append(f"光线风格: {scene['lighting_style']}")
                if scene.get("time_of_day"):
                    scene_parts.append(f"时间: {scene['time_of_day']}")
                if scene.get("weather"):
                    scene_parts.append(f"天气: {scene['weather']}")
                if scene.get("image_prompt"):
                    scene_parts.append(f"场景图片提示词: {scene['image_prompt']}")
                if scene_image_path:
                    scene_parts.append(f"场景图片路径: /assets/{scene_image_path}")
                scene_context = "\n".join(scene_parts)
        except Exception:
            pass

    image_reference_list = "\n".join(image_reference_lines) if image_reference_lines else "无可用图片引用"

    # Build duration hint from shot metadata
    estimated_duration_ms = max(0, int(shot.get("estimated_duration_ms", 0) or 0))
    if estimated_duration_ms > 0:
        duration_sec = max(2, min(8, round(estimated_duration_ms / 1000)))
        duration_hint = f"{duration_sec}秒（已预设）"
    else:
        duration_hint = "请根据镜头内容推断合适时长(2-8秒)"

    # Compute shot position within scene_block and adjacent shot goals
    episode_shots = shots_service.repository.list_shots(int(shot["episode_id"]))
    current_scene_block = shot.get("scene_block", "")
    same_scene_shots = [s for s in episode_shots if s.get("scene_block") == current_scene_block]
    shot_position = 1
    for i, s in enumerate(same_scene_shots, 1):
        if s["id"] == int(shot_id):
            shot_position = i
            break
    shot_position_hint = f"场次 {current_scene_block} 的第 {shot_position} 个镜头（共 {len(same_scene_shots)} 个）"

    # Find previous and next shot in the same episode
    prev_shot_goal = "无（本场第一个镜头）"
    next_shot_goal = "无（本场最后一个镜头）"
    prev_camera_angle = "无（本场第一个镜头）"
    for i, s in enumerate(episode_shots):
        if s["id"] == int(shot_id):
            if i > 0:
                prev_shot_goal = episode_shots[i - 1].get("visual_goal", "") or "无"
                prev_camera_angle = episode_shots[i - 1].get("camera_angle", "") or "无"
            if i < len(episode_shots) - 1:
                next_shot_goal = episode_shots[i + 1].get("visual_goal", "") or "无"
            break

    # Determine video image references based on with_first_frame option
    payload = parse_json(environ)
    with_first_frame = bool(payload.get("with_first_frame", False))
    with_storyboard = bool(payload.get("with_storyboard", False))
    rhythm_level = str(payload.get("rhythm_level", "") or "").strip()
    from . import build_rhythm_section
    rhythm_section = build_rhythm_section(rhythm_level, stage="prompt")
    if with_first_frame:
        next_idx = idx + 1
        first_frame_label = _ordinal_label(next_idx)
        video_image_reference_list = f"{first_frame_label} = 首帧图片 (镜头首帧截图)"
    else:
        video_image_reference_list = image_reference_list

    # Storyboard section — use storyboard text prompt (not image) for LLM context
    storyboard_section = ""
    storyboard_url = ""
    if with_storyboard:
        storyboard_url = (shot.get("storyboard_url") or "").strip()
        storyboard_prompt_text = (shot.get("storyboard_prompt") or "").strip()
        if storyboard_prompt_text:
            storyboard_section = f"## 故事板文本描述\n以下是当前镜头及相邻镜头的9格分镜故事板描述。请根据其中的运镜、动作、表情等信息，为当前镜头（标记★）生成提示词。角色的素描/线稿风格仅用于故事板参考，输出 prompt 中必须将角色还原为真人写实外观。\n\n{storyboard_prompt_text}"

    prompts_cfg = load_prompts()
    system_prompt = prompts_cfg.get("prompt_copilot_shot_prompt_system", "")
    user_template = prompts_cfg.get("prompt_copilot_shot_prompt_generate", "")
    if not system_prompt or not user_template:
        return respond_json(start_response, {"error": "Shot prompt generation prompts are not configured"}, status="500 Internal Server Error")

    user_goal = user_template.format(
        shot_size=shot.get("shot_size", ""),
        camera_angle=shot.get("camera_angle", ""),
        camera_motion=shot.get("camera_motion", ""),
        composition=shot.get("composition", ""),
        action_description=shot.get("action_description", ""),
        facial_emotion=shot.get("facial_emotion", ""),
        dialogue_excerpt=shot.get("dialogue_excerpt", ""),
        visual_goal=shot.get("visual_goal", ""),
        scene_block=shot.get("scene_block", ""),
        image_reference_list=image_reference_list,
        video_image_reference_list=video_image_reference_list,
        scene_context=scene_context,
        character_context=character_context,
        appearance_anchor_section=appearance_anchor_section,
        project_id=shot.get("project_id", ""),
        duration_hint=duration_hint,
        shot_position=shot_position_hint,
        prev_shot_goal=prev_shot_goal,
        next_shot_goal=next_shot_goal,
        prev_camera_angle=prev_camera_angle,
        rhythm_section=rhythm_section,
        storyboard_section=storyboard_section,
    )

    config = load_config()
    provider = ChatfireProvider(config)
    try:
        result_text = provider._chat(
            system=system_prompt,
            user=user_goal,
            timeout=90,
        )
    except Exception as exc:
        return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")

    proposal = _extract_shot_prompt_proposal(result_text or "")
    if not proposal:
        return respond_json(start_response, {"error": "Failed to generate prompt from LLM"}, status="500 Internal Server Error")

    # Use AI-inferred duration, fallback to shot's estimated_duration_ms
    final_duration = proposal.get("duration_seconds", 0) or 0
    if final_duration <= 0 and estimated_duration_ms > 0:
        final_duration = max(2, min(8, round(estimated_duration_ms / 1000)))
    elif final_duration <= 0:
        final_duration = 3

    # Inject motion-specific negative keywords
    camera_motion = shot.get("camera_motion", "")
    proposal["video_negative_prompt"] = _inject_motion_negative(proposal["video_negative_prompt"], camera_motion)

    return respond_json(start_response, {
        "first_frame_prompt": proposal["first_frame_prompt"],
        "first_frame_negative_prompt": proposal["first_frame_negative_prompt"],
        "video_prompt": proposal["video_prompt"],
        "video_negative_prompt": proposal["video_negative_prompt"],
        "negative_prompt": proposal["negative_prompt"],
        "duration_seconds": final_duration,
        "image_references": image_refs,
        "storyboard_url": storyboard_url,
    })


generation_service = GenerationService()


def _run_generate_prompt_frame(task_id: int, prompt_id: int, first_frame_prompt: str, reference_images: list[str], aspect_ratio: str = "16:9") -> None:
    """Background worker: generate first frame image and persist to local storage."""
    prompts_svc = PromptsService()
    gen_svc = GenerationService()
    cfg = load_config()
    prompts_svc.update_prompt(prompt_id, {"first_frame_status": "generating"})
    try:
        # Call external image generation API
        size_map = {"16:9": "2560x1440", "9:16": "1440x2560", "1:1": "2048x2048", "4:3": "2048x1536", "3:4": "1536x2048"}
        size = size_map.get(aspect_ratio, "2560x1440")
        api_body = {"model": cfg.image_model, "prompt": first_frame_prompt, "size": size, "n": 1}
        if reference_images:
            api_body["image"] = reference_images if len(reference_images) > 1 else reference_images[0]
        resp = _req.post(
            f"{cfg.api_base}/v1/images/generations",
            headers={"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"},
            json=api_body, timeout=(30, 300),
        )
        if resp.status_code != 200:
            raise RuntimeError(resp.text[:200])
        data = resp.json()
        image_url = data["data"][0]["url"]

        # Download image to local assets
        img_resp = _req.get(image_url, timeout=(10, 120))
        if img_resp.status_code != 200:
            raise RuntimeError(f"Failed to download image: {img_resp.status_code}")
        ext = ".png"
        content_type = img_resp.headers.get("content-type", "")
        if "jpeg" in content_type or "jpg" in content_type:
            ext = ".jpg"
        elif "webp" in content_type:
            ext = ".webp"
        filename = f"frame_{uuid.uuid4().hex[:12]}{ext}"
        filepath = ASSETS_DIR / filename
        filepath.write_bytes(img_resp.content)

        # Update shot_prompt with local path
        prompts_svc.update_prompt(prompt_id, {"first_frame_url": filename, "first_frame_status": "succeeded"})

        # Update generation task
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"url": filename, "type": "image"}]),
            "finished_at": None,  # will be auto-handled
        })
    except Exception as exc:
        prompts_svc.update_prompt(prompt_id, {"first_frame_status": "failed"})
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc)[:500],
        })


_frame_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="frame-gen")


def _stylize_image(img):
    """No-op: return image unchanged."""
    return img


def _img_to_base64(path: Path, max_size: int = 768, stylize: bool = False) -> str | None:
    """Read image, resize if needed, optionally stylize, return data URI string."""
    from PIL import Image

    img = Image.open(path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    if stylize:
        img = _stylize_image(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _build_frame_reference_images(shot: dict, stylize: bool = False) -> list[str]:
    """Load character + scene images in 图一/图二 order, return base64 data URIs."""
    reference_images: list[str] = []

    character_ids_raw = shot.get("character_ids", "[]")
    if isinstance(character_ids_raw, str):
        try:
            character_ids = json.loads(character_ids_raw)
        except (json.JSONDecodeError, TypeError):
            character_ids = []
    elif isinstance(character_ids_raw, list):
        character_ids = character_ids_raw
    else:
        character_ids = []

    for cid in character_ids[:5]:
        try:
            char = assets_service.get_character(int(cid))
            if char and char.get("image_path"):
                full_path = ASSETS_DIR / char["image_path"]
                if full_path.exists():
                    b64 = _img_to_base64(full_path, stylize=stylize)
                    if b64:
                        reference_images.append(b64)
        except Exception:
            continue

    scene_preset_id = shot.get("scene_preset_id")
    if scene_preset_id:
        try:
            scene = assets_service.get_scene_preset(int(scene_preset_id))
            if scene:
                variants = scene.get("variants", "[]")
                if isinstance(variants, str):
                    variants = json.loads(variants)
                if isinstance(variants, list):
                    for v in variants:
                        if isinstance(v, dict) and v.get("imagePath"):
                            full_path = ASSETS_DIR / v["imagePath"]
                            if full_path.exists():
                                b64 = _img_to_base64(full_path, stylize=stylize)
                                if b64:
                                    reference_images.append(b64)
                            break
        except Exception:
            pass

    return reference_images


@register("POST", r"/api/shot-prompts/(?P<prompt_id>\d+)/generate-frame")
def submit_generate_frame(environ, start_response, prompt_id: str):
    prompts_svc = PromptsService()
    try:
        prompt = prompts_svc.get_prompt(int(prompt_id))
    except ValueError:
        return respond_json(start_response, {"error": "Prompt not found"}, status="404 Not Found")

    shot_id = int(prompt["shot_id"])
    shots_svc = ShotsService()
    try:
        shot = shots_svc.get_shot(shot_id)
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    episode = shots_svc.repository.get_episode(int(shot["episode_id"]))
    project_id = int(episode["project_id"]) if episode else 0

    payload = parse_json(environ)
    aspect_ratio = str(payload.get("aspect_ratio", "16:9"))

    reference_images = _build_frame_reference_images(shot)

    first_frame_prompt = str(prompt.get("first_frame_prompt") or prompt.get("prompt_text", "")).strip()
    if not first_frame_prompt:
        return respond_json(start_response, {"error": "Prompt has no first_frame_prompt"}, status="400 Bad Request")
    cfg = load_config()
    task_payload = {
        "project_id": project_id,
        "episode_id": int(shot["episode_id"]),
        "shot_id": shot_id,
        "shot_prompt_id": int(prompt_id),
        "provider": "api",
        "model_name": cfg.image_model,
        "status": "queued",
        "input_payload": json.dumps({"first_frame_prompt": first_frame_prompt, "reference_images": reference_images, "aspect_ratio": aspect_ratio}),
        "output_assets": "[]",
        "retry_count": 0,
        "error_message": "",
        "cost_amount": 0,
        "duration_ms": 0,
    }
    task_id = generation_service.repository.create_task(task_payload)
    prompts_svc.update_prompt(int(prompt_id), {"first_frame_status": "queued"})
    generation_service.repository.update_task(task_id, {"status": "running"})
    _frame_executor.submit(_run_generate_prompt_frame, task_id, int(prompt_id), first_frame_prompt, reference_images, aspect_ratio)
    task = generation_service.get_task(task_id)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


def _run_generate_prompt_video(task_id: int, prompt_id: int, first_frame_prompt: str, reference_images: list[str], aspect_ratio: str = "16:9", with_first_frame: bool = False, duration: int = 5, resolution: str = "720p", model_name: str = "") -> None:
    """Background worker: generate video via seedance. If with_first_frame: i2v (1 first_frame image). Else: character mode (multiple reference_image)."""
    from ..config import load_seedance_config
    from ..providers.seedance import SeedanceProvider

    prompts_svc = PromptsService()
    gen_svc = GenerationService()
    prompts_svc.update_prompt(prompt_id, {"video_status": "generating"})
    try:
        seedance_cfg = load_seedance_config()
        if not seedance_cfg.seedance_api_key:
            raise RuntimeError("Seedance API key not configured")

        # Enhance prompt for realistic human output
        prompts_cfg = load_prompts()
        video_realism_template = prompts_cfg.get("prompt_video_realism", "{video_prompt}")
        enhanced_prompt = video_realism_template.format(video_prompt=first_frame_prompt)

        def _on_progress(msg: str) -> None:
            if "下载" in msg:
                prompts_svc.update_prompt(prompt_id, {"video_status": "downloading"})
        provider = SeedanceProvider(seedance_cfg, on_progress=_on_progress)
        if with_first_frame:
            video_path = provider.generate_i2v(
                task_id=task_id,
                prompt=enhanced_prompt,
                images_list=reference_images,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                duration=duration,
                remove_watermark=False,
                model_name=model_name,
            )
        else:
            video_path = provider.generate_character(
                task_id=task_id,
                images_list=reference_images,
                prompt=enhanced_prompt,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                duration=duration,
                remove_watermark=False,
                model_name=model_name,
            )
        prompts_svc.update_prompt(prompt_id, {"video_url": video_path, "video_status": "succeeded"})
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"url": video_path, "type": "video"}]),
        })
    except Exception as exc:
        import sys
        print(f"[VIDEO_GEN] task_id={task_id} prompt_id={prompt_id} FAILED: {exc}", file=sys.stderr, flush=True)
        prompts_svc.update_prompt(prompt_id, {"video_status": "failed"})
        err_msg = str(exc)[:500]
        if hasattr(exc, "response") and exc.response is not None:
            try:
                err_msg += " | " + exc.response.text[:300]
            except Exception:
                pass
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": err_msg,
        })


_video_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="video-gen")
_storyboard_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="storyboard")
_storyboard_video_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="storyboard-video")


def _build_storyboard_prompt(shot: dict, char_descriptions: list[str], scene_context: str, episode_shots: list[dict], image_reference_lines: list[str]) -> str:
    """Build a Chinese prompt for generating a 3×3 9-grid storyboard image."""
    current_id = int(shot["id"])
    current_idx = None
    for i, s in enumerate(episode_shots):
        if s["id"] == current_id:
            current_idx = i
            break

    # Select up to 9 shots centered on current
    if current_idx is None:
        target_shots = [shot]
    else:
        total = len(episode_shots)
        window = min(9, total)
        half = window // 2
        start = max(0, current_idx - half)
        end = min(total, start + window)
        if end - start < window:
            start = max(0, end - window)
        target_shots = episode_shots[start:end]

    ref_lines_str = "\n".join(image_reference_lines) if image_reference_lines else "无"

    frames = []
    for s in target_shots:
        label = "★ 当前镜头" if s["id"] == current_id else ""
        frames.append({
            "shot_no": s.get("shot_no", 0),
            "shot_size": s.get("shot_size", ""),
            "camera_angle": s.get("camera_angle", ""),
            "action": s.get("action_description", ""),
            "emotion": s.get("facial_emotion", ""),
            "label": label,
        })

    frame_descriptions = []
    for i, f in enumerate(frames):
        parts = [
            f"第{i+1}帧{f['label']}：{f['shot_size']} {f['camera_angle']}。{f['action']}",
        ]
        if f["emotion"]:
            parts.append(f"表情：{f['emotion']}")
        frame_descriptions.append(" ".join(parts))

    frames_text = "\n".join(frame_descriptions)

    prompt = f"""3×3九宫格电影分镜故事板，均匀九等分网格，白色细线分隔，从左到右从上到下按时间顺序排列{len(frames)}帧，每帧16:9横构图。所有角色以全彩线稿/素描风格绘制——保留面部结构与身份特征，不渲染为真人写实照片，保持角色设定图的手绘质感。场景保持真实写实质感。

参考图片：
{ref_lines_str}

场景：{scene_context}

角色信息：
{chr(10).join(char_descriptions)}

各帧描述：
{frames_text}

要求：
- 所有角色在全部分镜格中保持外貌完全一致
- 角色以全彩线稿风格呈现（非黑白素描、非真人写实），保留清晰的五官轮廓和发丝线条
- 场景为真实写实质感：灯光、材质、空间透视均写实
- 统一暖金色调，电影级构图
- 不要任何真人照片质感的人脸，角色部分必须是手绘/线稿风格"""

    return prompt


def _generate_storyboard_video_prompt(
    shot: dict,
    storyboard_prompt: str,
    char_descriptions: list[str],
    scene_context: str,
) -> str:
    """Generate a timeline-based video prompt from storyboard text.

    This produces a special prompt format that treats the 9-grid as a keyframe
    timeline, with each cell mapped to a time segment. Designed to be used with
    the storyboard image as reference for video generation (animatic style).
    """
    char_context_text = "\n".join(char_descriptions) if char_descriptions else "无"

    # Build a system/user prompt for the LLM to generate the timeline video prompt
    system = (
        "你是电影分镜师。你会根据9宫格故事板的文本描述，生成一段可直接用于视频生成模型的提示词。"
        "将9宫格视为关键帧时间线——每格是一个时间锚点，从左到右从上到下依次对应镜头的不同时间点。"
        "格子与格子之间的空白由视频模型插值生成过渡帧。"
        "角色必须输出为真实人像质感（真肤、发丝光泽、服装纹理、电影光影），拒绝素描/线稿/插画风格。"
        "最后附带负向提示词段。"
        "你必须严格按以下格式输出，不得使用任何其他格式：\n\n"
        "【图片引用说明】\n"
        "图一中的九宫格分镜故事板，按从左到右、从上到下的顺序读取每格，各格画面依次映射到本镜头的时间线。"
        "九宫格中的角色为CG渲染风格，在生成视频时必须将所有角色还原为真实人像——"
        "真实肤色、自然发丝光泽、真实服装材质纹理、电影级写实摄影质感，"
        "严禁保留CG感、3D渲染质感、动画风格或任何非真人质感。\n\n"
        "【初始画面·第0秒】\n"
        "对应故事板第1格。画面内容：……（详细描述场景、人物位置姿态、光线氛围）。\n\n"
        "【0-X秒·动作段一】\n"
        "对应故事板第1格至第3格。运镜：……（具体描述镜头运动方式）。画面变化：……\n\n"
        "【X-Y秒·动作段二】\n"
        "对应故事板第4格至第6格。运镜：……。画面变化：……\n\n"
        "【Y-Z秒·高潮段】\n"
        "对应故事板第7格至第9格。运镜：……。画面变化：……\n\n"
        "【负向提示词】\n"
        "画面抖动、镜头卡顿、跳帧、人物变形、九宫格分割线残留、格线可见、拼贴画、画面撕裂"
    )

    user = f"""请根据以下9宫格故事板描述，生成一段时间线格式的视频提示词。

【场景】
{scene_context}

【角色】
{char_context_text}

【故事板文本描述】
{storyboard_prompt}

【当前镜头信息】
景别: {shot.get('shot_size', '')}
机位: {shot.get('camera_angle', '')}
运镜: {shot.get('camera_motion', '')}
视觉目标: {shot.get('visual_goal', '')}
对白: {shot.get('dialogue_excerpt', '')}
预估时长: {max(2, min(8, round(max(0, int(shot.get('estimated_duration_ms', 0) or 0)) / 1000))) if shot.get('estimated_duration_ms') else '3'}秒

要求：
1. 按【初始画面·第0秒】【0-X秒·动作段】【X-Y秒·对白】...的时间轴格式输出
2. 每段标注对应第几格（例如：对应故事板第1格到第3格）
3. 运镜描述要具体（前推速度、跟拍距离、落幅构图）
4. 角色的素描/线稿风格来自故事板参考，输出时全部还原为真实人像外观
5. 末尾附【负向提示词】段：画面抖动、镜头卡顿、跳帧、人物变形、九宫格分割线残留、格线可见、拼贴画、画面撕裂
6. 整体提示词约500-800字
7. 直接输出提示词正文，不要JSON包裹，不要Markdown代码块，不要任何额外说明"""

    config = load_config()
    provider = ChatfireProvider(config)
    result = provider._chat(system=system, user=user, timeout=90)
    return (result or "").strip()


def _run_generate_storyboard(task_id: int, shot_id: int) -> None:
    """Background worker: generate 9-grid storyboard image AND video prompts from storyboard text."""
    gen_svc = GenerationService()
    shots_svc = ShotsService()
    cfg = load_config()

    try:
        shot = shots_svc.get_shot(shot_id)
        episode_id = int(shot["episode_id"])
        episode_shots = shots_svc.repository.list_shots(episode_id)
        episode_shots.sort(key=lambda s: (s.get("sort_order", 0) or s.get("shot_no", 0) or 0))

        # Build character descriptions and reference images
        character_ids_raw = shot.get("character_ids", "[]")
        if isinstance(character_ids_raw, str):
            try:
                character_ids = json.loads(character_ids_raw)
            except (json.JSONDecodeError, TypeError):
                character_ids = []
        elif isinstance(character_ids_raw, list):
            character_ids = character_ids_raw
        else:
            character_ids = []

        image_reference_lines = []
        char_descriptions = []
        for cid in (character_ids or [])[:5]:
            try:
                char = assets_service.get_character(int(cid))
                if char:
                    name = char.get("name", "角色")
                    image_path = char.get("image_path", "")
                    image_reference_lines.append(f"图{len(image_reference_lines)+1} = {name} (角色全彩线稿图)")
                    parts = [f"角色: {name}"]
                    if char.get("appearance_summary"):
                        parts.append(f"外观: {char['appearance_summary']}")
                    char_descriptions.append(" | ".join(parts))
            except Exception:
                continue

        scene_context = "无"
        scene_preset_id = shot.get("scene_preset_id")
        if scene_preset_id:
            try:
                scene = assets_service.get_scene_preset(int(scene_preset_id))
                if scene:
                    scene_context = f"{scene.get('name', '')} - {scene.get('space_description', '')} | 灯光: {scene.get('lighting_style', '')} | 时间: {scene.get('time_of_day', '')}"
                    variants = scene.get("variants", "[]")
                    if isinstance(variants, str):
                        variants = json.loads(variants)
                    if isinstance(variants, list) and variants:
                        first_v = variants[0]
                        if isinstance(first_v, dict) and first_v.get("imagePath"):
                            image_reference_lines.append(f"图{len(image_reference_lines)+1} = {scene.get('name', '场景')} (场景参考图)")
            except Exception:
                pass

        # Build the storyboard prompt
        storyboard_prompt = _build_storyboard_prompt(shot, char_descriptions, scene_context, episode_shots, image_reference_lines)

        # Build reference images from character + scene files
        reference_images = _build_frame_reference_images(shot)

        # Call image generation API
        size = "2560x1440"
        api_body = {"model": cfg.image_model, "prompt": storyboard_prompt, "size": size, "n": 1}
        if reference_images:
            api_body["image"] = reference_images if len(reference_images) > 1 else reference_images[0]
        resp = _req.post(
            f"{cfg.api_base}/v1/images/generations",
            headers={"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"},
            json=api_body, timeout=(30, 300),
        )
        if resp.status_code != 200:
            raise RuntimeError(resp.text[:200])
        data = resp.json()
        image_url = data["data"][0]["url"]

        # Download to local assets
        img_resp = _req.get(image_url, timeout=(10, 120))
        if img_resp.status_code != 200:
            raise RuntimeError(f"Failed to download storyboard: {img_resp.status_code}")
        ext = ".png"
        content_type = img_resp.headers.get("content-type", "")
        if "jpeg" in content_type or "jpg" in content_type:
            ext = ".jpg"
        elif "webp" in content_type:
            ext = ".webp"
        filename = f"storyboard_{shot_id}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = ASSETS_DIR / filename
        filepath.write_bytes(img_resp.content)

        # Save storyboard prompt and video prompt as text files alongside the image
        base_name = filename.rsplit(".", 1)[0]
        storyboard_prompt_file = f"{base_name}_prompt.txt"
        (ASSETS_DIR / storyboard_prompt_file).write_text(storyboard_prompt, encoding="utf-8")

        # Generate storyboard-to-video prompt (timeline format for animatic generation)
        storyboard_video_prompt = ""
        try:
            storyboard_video_prompt = _generate_storyboard_video_prompt(
                shot, storyboard_prompt, char_descriptions, scene_context
            )
            if storyboard_video_prompt:
                storyboard_video_prompt_file = f"{base_name}_video_prompt.txt"
                (ASSETS_DIR / storyboard_video_prompt_file).write_text(storyboard_video_prompt, encoding="utf-8")
        except Exception:
            pass  # prompt generation is best-effort; image is the primary output

        # Update shot record
        shots_svc.repository.update_shot(shot_id, {
            "storyboard_url": filename,
            "storyboard_prompt": storyboard_prompt,
            "storyboard_video_prompt": storyboard_video_prompt,
        })

        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"url": filename, "type": "storyboard"}]),
        })
    except Exception as exc:
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc)[:500],
        })


def _run_generate_storyboard_video(task_id: int, shot_id: int) -> None:
    """Background worker: generate video from storyboard image as reference_image."""
    from ..providers.seedance import SeedanceProvider

    shots_svc = ShotsService()
    gen_svc = GenerationService()
    shot = shots_svc.get_shot(shot_id)
    storyboard_url = (shot.get("storyboard_url") or "").strip()
    storyboard_video_prompt = (shot.get("storyboard_video_prompt") or "").strip()

    if not storyboard_url or not storyboard_video_prompt:
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": "Missing storyboard_url or storyboard_video_prompt",
        })
        return

    shots_svc.repository.update_shot(shot_id, {"storyboard_video_status": "generating"})
    try:
        image_path = ASSETS_DIR / storyboard_url
        if not image_path.exists():
            raise RuntimeError(f"Storyboard image not found: {storyboard_url}")
        image_b64 = _img_to_base64(image_path, max_size=1024)
        if not image_b64:
            raise RuntimeError("Failed to encode storyboard image")

        seedance_cfg = load_seedance_config()
        if not seedance_cfg.seedance_api_key:
            raise RuntimeError("Seedance API key not configured")

        duration = max(3, min(10, round(int(shot.get("estimated_duration_ms", 5000)) / 1000)))

        provider = SeedanceProvider(seedance_cfg)
        video_path = provider.generate_character(
            task_id=task_id,
            images_list=[image_b64],
            prompt=storyboard_video_prompt,
            aspect_ratio="16:9",
            duration=duration,
        )
        shots_svc.repository.update_shot(shot_id, {
            "storyboard_video_url": video_path,
            "storyboard_video_status": "succeeded",
        })
        gen_svc.repository.update_task(task_id, {
            "status": "succeeded",
            "output_assets": json.dumps([{"url": video_path, "type": "video"}]),
        })
    except Exception as exc:
        import sys
        print(f"[STORYBOARD_VIDEO] task_id={task_id} shot_id={shot_id} FAILED: {exc}", file=sys.stderr, flush=True)
        shots_svc.repository.update_shot(shot_id, {"storyboard_video_status": "failed"})
        gen_svc.repository.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc)[:500],
        })


@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate-storyboard-video")
def submit_generate_storyboard_video(environ, start_response, shot_id: str):
    shots_svc = ShotsService()
    try:
        shot = shots_svc.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    storyboard_url = (shot.get("storyboard_url") or "").strip()
    storyboard_video_prompt = (shot.get("storyboard_video_prompt") or "").strip()
    if not storyboard_url or not storyboard_video_prompt:
        return respond_json(start_response, {"error": "Shot has no storyboard image or video prompt"}, status="400 Bad Request")

    episode = shots_svc.repository.get_episode(int(shot["episode_id"]))
    project_id = int(episode["project_id"]) if episode else 0

    cfg = load_config()
    task_payload = {
        "project_id": project_id,
        "episode_id": int(shot["episode_id"]),
        "shot_id": int(shot_id),
        "provider": "seedance",
        "model_name": cfg.image_model,
        "status": "queued",
        "input_payload": json.dumps({"action": "generate_storyboard_video", "shot_id": int(shot_id)}),
        "output_assets": "[]",
        "retry_count": 0,
        "error_message": "",
        "cost_amount": 0,
        "duration_ms": 0,
    }
    task_id = generation_service.repository.create_task(task_payload)
    generation_service.repository.update_task(task_id, {"status": "running"})
    _storyboard_video_executor.submit(_run_generate_storyboard_video, task_id, int(shot_id))
    task = generation_service.get_task(task_id)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/shots/(?P<shot_id>\d+)/generate-storyboard")
def submit_generate_storyboard(environ, start_response, shot_id: str):
    shots_svc = ShotsService()
    try:
        shot = shots_svc.get_shot(int(shot_id))
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    episode = shots_svc.repository.get_episode(int(shot["episode_id"]))
    project_id = int(episode["project_id"]) if episode else 0

    cfg = load_config()
    task_payload = {
        "project_id": project_id,
        "episode_id": int(shot["episode_id"]),
        "shot_id": int(shot_id),
        "provider": "api",
        "model_name": cfg.image_model,
        "status": "queued",
        "input_payload": json.dumps({"action": "generate_storyboard", "shot_id": int(shot_id)}),
        "output_assets": "[]",
        "retry_count": 0,
        "error_message": "",
        "cost_amount": 0,
        "duration_ms": 0,
    }
    task_id = generation_service.repository.create_task(task_payload)
    generation_service.repository.update_task(task_id, {"status": "running"})
    _storyboard_executor.submit(_run_generate_storyboard, task_id, int(shot_id))
    task = generation_service.get_task(task_id)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")


@register("POST", r"/api/shot-prompts/(?P<prompt_id>\d+)/generate-video")
def submit_generate_video(environ, start_response, prompt_id: str):
    prompts_svc = PromptsService()
    try:
        prompt = prompts_svc.get_prompt(int(prompt_id))
    except ValueError:
        return respond_json(start_response, {"error": "Prompt not found"}, status="404 Not Found")

    shot_id = int(prompt["shot_id"])
    shots_svc = ShotsService()
    try:
        shot = shots_svc.get_shot(shot_id)
    except ValueError:
        return respond_json(start_response, {"error": "Shot not found"}, status="404 Not Found")

    episode = shots_svc.repository.get_episode(int(shot["episode_id"]))
    project_id = int(episode["project_id"]) if episode else 0

    payload = parse_json(environ)
    with_first_frame = bool(payload.get("with_first_frame", False))
    aspect_ratio = str(payload.get("aspect_ratio", "16:9"))

    # Read duration/resolution from request, fallback to prompt's model_params, then defaults
    model_params = json.loads(str(prompt.get("model_params", "{}") or "{}"))
    duration = int(payload.get("duration") or model_params.get("duration_seconds", 0) or 5)
    resolution = str(payload.get("resolution") or model_params.get("resolution", "") or "720p")

    # Build reference images
    if with_first_frame:
        # Use the generated first frame image as the single first_frame
        first_frame_url = str(prompt.get("first_frame_url", "")).strip()
        if not first_frame_url:
            return respond_json(start_response, {"error": "No first frame image available. Generate the first frame first."}, status="400 Bad Request")
        frame_path = ASSETS_DIR / first_frame_url
        if not frame_path.exists():
            return respond_json(start_response, {"error": f"First frame image not found: {first_frame_url}"}, status="400 Bad Request")
        b64 = _img_to_base64(frame_path, stylize=True)
        if not b64:
            return respond_json(start_response, {"error": "Failed to encode first frame image"}, status="500 Internal Server Error")
        reference_images = [b64]
    else:
        reference_images = _build_frame_reference_images(shot, stylize=True)

    video_prompt = str(prompt.get("video_prompt") or prompt.get("first_frame_prompt") or prompt.get("prompt_text", "")).strip()
    if not video_prompt:
        return respond_json(start_response, {"error": "Prompt has no video_prompt"}, status="400 Bad Request")
    cfg = load_config()
    seedance_cfg = load_seedance_config()
    task_payload = {
        "project_id": project_id,
        "episode_id": int(shot["episode_id"]),
        "shot_id": shot_id,
        "shot_prompt_id": int(prompt_id),
        "provider": "seedance",
        "model_name": seedance_cfg.seedance_model,
        "status": "queued",
        "input_payload": json.dumps({"video_prompt": video_prompt, "reference_images": reference_images, "with_first_frame": with_first_frame, "aspect_ratio": aspect_ratio, "duration": duration, "resolution": resolution}),
        "output_assets": "[]",
        "retry_count": 0,
        "error_message": "",
        "cost_amount": 0,
        "duration_ms": 0,
    }
    task_id = generation_service.repository.create_task(task_payload)
    prompts_svc.update_prompt(int(prompt_id), {"video_status": "queued"})
    generation_service.repository.update_task(task_id, {"status": "running"})
    _video_executor.submit(_run_generate_prompt_video, task_id, int(prompt_id), video_prompt, reference_images, aspect_ratio, with_first_frame, duration, resolution, seedance_cfg.seedance_model)
    task = generation_service.get_task(task_id)
    return respond_json(start_response, {"task": serialize_task(task)}, status="202 Accepted")
