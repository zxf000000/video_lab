from __future__ import annotations

import json
import re
import time
from pathlib import Path

import requests

from ..config import AppConfig, DEFAULT_PROMPTS
from ..db import ASSETS_DIR
from .utils import download_asset


class ChatfireProvider:
    """OpenAI-compatible provider via chatfire proxy. Implements Text + Image + Video."""

    def __init__(self, config: AppConfig, prompts: dict[str, str] | None = None):
        self._config = config
        self._base_url = config.api_base.rstrip("/")
        self._api_key = config.api_key
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        self._prompts = prompts or dict(DEFAULT_PROMPTS)

    def _p(self, key: str) -> str:
        return self._prompts.get(key, DEFAULT_PROMPTS.get(key, ""))

    @staticmethod
    def _image_size_for_aspect_ratio(aspect_ratio: str) -> str:
        size_map = {
            "16:9": "2560x1440",
            "9:16": "1440x2560",
            "1:1": "2048x2048",
            "4:3": "2048x1536",
        }
        return size_map.get(aspect_ratio or "16:9", "2560x1440")

    @staticmethod
    def _ordinal_label(index: int) -> str:
        labels = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
        if 1 <= index <= len(labels):
            return f"图{labels[index - 1]}"
        return f"图{index}"

    def _build_reference_map(self, character_names: list[str], scene_name: str) -> list[tuple[str, str, str]]:
        refs: list[tuple[str, str, str]] = []
        idx = 1
        for name in character_names:
            refs.append((self._ordinal_label(idx), "角色", name))
            idx += 1
        scene_label = self._ordinal_label(idx if character_names else 1)
        refs.append((scene_label, "场景", scene_name or "当前场景"))
        return refs

    @staticmethod
    def _normalize_reference_label_text(text: str) -> str:
        if not text:
            return ""

        def _replace(match: re.Match[str]) -> str:
            raw = match.group(1)
            if raw.isdigit():
                try:
                    return ChatfireProvider._ordinal_label(int(raw))
                except ValueError:
                    return match.group(0)
            return match.group(0)

        return re.sub(r"图(\d+)", _replace, str(text))

    def _is_reference_prompt_valid(
        self,
        prompt_text: str,
        refs: list[tuple[str, str, str]],
    ) -> bool:
        normalized_text = self._normalize_reference_label_text(prompt_text).strip()
        if not normalized_text:
            return False

        ref_map = {label: (kind, value) for label, kind, value in refs}
        matches = list(re.finditer(r"(图[一二三四五六七八九十\d]+)", normalized_text))
        if not matches:
            return False

        for index, match in enumerate(matches):
            label = self._normalize_reference_label_text(match.group(1))
            if label not in ref_map:
                return False
            next_start = matches[index + 1].start() if index + 1 < len(matches) else len(normalized_text)
            segment = normalized_text[match.end():next_start].strip("，。；：、 \n\t")
            if not segment:
                return False
            kind, expected_value = ref_map[label]
            allowed_prefixes = [
                expected_value,
                f"为{expected_value}",
                f"中的{expected_value}",
                f"里的{expected_value}",
                f"中{expected_value}",
                f"里{expected_value}",
            ]
            if kind == "角色":
                allowed_prefixes.extend(["中的角色", "里的角色", "对应角色", "角色"])
            else:
                allowed_prefixes.extend(["中的场景", "里的场景", "对应场景", "场景"])
            if not any(segment.startswith(prefix) for prefix in allowed_prefixes):
                return False
        return True

    def _rewrite_reference_prompt(
        self,
        frame_kind: str,
        shot_prompt: str,
        character_names: list[str],
        scene_name: str,
        scene_description: str,
        character_action: str,
    ) -> str:
        refs = self._build_reference_map(character_names, scene_name)
        ref_text = "，".join(f"{label}为{value}" for label, _, value in refs)
        if character_names:
            subject_parts = []
            for label, kind, value in refs:
                if kind != "角色":
                    continue
                phase_text = "处于镜头开始瞬间，动作刚刚展开" if frame_kind == "start" else "处于镜头结束瞬间，动作已经推进到收束节点"
                subject_parts.append(f"{label}中的{value}{phase_text}")
            subject_text = "；".join(subject_parts)
            if character_action:
                subject_text = f"{subject_text}。主要动作：{character_action}"
        else:
            subject_text = "画面主体动作已经被镜头稳定捕捉"

        scene_label = refs[-1][0] if refs else self._ordinal_label(1)
        scene_value = scene_name or "当前场景"
        scene_body = scene_description or scene_value
        scene_text = f"{scene_label}中的{scene_value}保持环境一致，{scene_body}"
        return f"{ref_text}。{subject_text}。{scene_text}。{shot_prompt}".strip()

    def _build_frame_prompt_fallback(
        self,
        frame_kind: str,
        shot_prompt: str,
        character_names: list[str],
        scene_name: str,
    ) -> str:
        return self._rewrite_reference_prompt(
            frame_kind=frame_kind,
            shot_prompt=shot_prompt,
            character_names=character_names,
            scene_name=scene_name,
            scene_description=scene_name,
            character_action="",
        )

    @staticmethod
    def _infer_narration_text(
        shot_description: str,
        shot_prompt: str,
        character_action: str,
        emotion_keywords: str,
        character_ids: list[str],
    ) -> str:
        combined_text = " ".join(
            part.strip() for part in (shot_description, shot_prompt, character_action) if str(part).strip()
        )
        if not combined_text:
            return ""

        quoted_matches = re.findall(r"[\"“](.+?)[\"”]", combined_text)
        if quoted_matches:
            candidate = quoted_matches[0].strip().strip("，。！？；：")
            return candidate[:24]

        emotion_text = emotion_keywords or ""
        tense_words = ("紧张", "惊慌", "恐惧", "压迫", "焦灼")
        sad_words = ("悲伤", "失落", "遗憾", "痛苦", "低落")
        angry_words = ("愤怒", "愤恨", "不甘", "对抗")
        hopeful_words = ("希望", "释然", "坚定", "温柔", "欣慰")

        if any(word in combined_text for word in ("心想", "想起", "回忆", "迟疑", "犹豫", "沉默", "凝视", "愣住", "下定决心")):
            if any(word in emotion_text for word in tense_words):
                return "不能再拖下去了。"
            if any(word in emotion_text for word in sad_words):
                return "原来一切都回不去了。"
            if any(word in emotion_text for word in hopeful_words):
                return "这一次我不会放手。"
            return "事情正在慢慢失控。"

        if any(word in combined_text for word in ("说", "问", "回答", "回应", "喊", "叫住", "低声", "开口", "争执", "对话", "交谈")):
            if any(word in emotion_text for word in tense_words):
                return "别再靠近了。"
            if any(word in emotion_text for word in angry_words):
                return "我不会再退了。"
            if any(word in emotion_text for word in hopeful_words):
                return "终于等到这一刻了。"
            if character_ids:
                return "你终于来了。"
            return "先听我把话说完。"

        return ""

    def _normalize_shot(
        self,
        shot: dict,
        default_duration: int,
        fallback_index: int,
        available_character_names: list[str],
        available_scene_names: list[str],
    ) -> dict:
        normalized = dict(shot)
        normalized["shot_title"] = str(normalized.get("shot_title") or f"镜头 {fallback_index}")
        normalized["shot_description"] = str(normalized.get("shot_description") or normalized.get("shot_prompt") or "")
        normalized["shot_prompt"] = str(normalized.get("shot_prompt") or normalized["shot_description"] or normalized["shot_title"])

        try:
            duration = int(normalized.get("duration_seconds", default_duration))
        except (TypeError, ValueError):
            duration = default_duration
        normalized["duration_seconds"] = max(2, min(8, duration))

        raw_character_ids = normalized.get("character_ids")
        if isinstance(raw_character_ids, list):
            character_ids = [str(name) for name in raw_character_ids if str(name).strip()]
        elif raw_character_ids:
            character_ids = [str(raw_character_ids)]
        else:
            character_ids = []

        valid_character_ids = [name for name in character_ids if name in available_character_names]
        if not valid_character_ids and available_character_names:
            valid_character_ids = available_character_names[:1]
        normalized["character_ids"] = valid_character_ids

        scene_name = str(normalized.get("scene_name") or "")
        if scene_name not in available_scene_names:
            scene_name = available_scene_names[0] if available_scene_names else scene_name
        normalized["scene_name"] = scene_name

        normalized["scene_description"] = str(normalized.get("scene_description") or normalized["shot_description"] or normalized["scene_name"])
        normalized["camera_movement"] = str(normalized.get("camera_movement") or "固定")
        normalized["emotion_keywords"] = str(normalized.get("emotion_keywords") or "")
        character_action = str(normalized.get("character_action") or "").strip()
        if not character_action:
            if valid_character_ids:
                names_text = "、".join(valid_character_ids)
                character_action = f"{names_text}在{scene_name or '当前场景'}中推进当前镜头动作"
            else:
                character_action = f"主体在{scene_name or '当前场景'}中完成当前镜头动作"
        normalized["character_action"] = character_action

        narration_text = str(normalized.get("narration_text") or "").strip()
        if not narration_text:
            narration_text = self._infer_narration_text(
                normalized["shot_description"],
                normalized["shot_prompt"],
                character_action,
                normalized["emotion_keywords"],
                valid_character_ids,
            )
        normalized["narration_text"] = narration_text

        refs = self._build_reference_map(valid_character_ids, scene_name)
        start_frame_prompt = self._normalize_reference_label_text(str(normalized.get("start_frame_prompt") or "").strip())
        end_frame_prompt = self._normalize_reference_label_text(str(normalized.get("end_frame_prompt") or "").strip())

        if not self._is_reference_prompt_valid(start_frame_prompt, refs):
            start_frame_prompt = self._rewrite_reference_prompt(
                "start",
                normalized["shot_prompt"],
                valid_character_ids,
                scene_name,
                normalized["scene_description"],
                character_action,
            )
        if not self._is_reference_prompt_valid(end_frame_prompt, refs):
            end_frame_prompt = self._rewrite_reference_prompt(
                "end",
                normalized["shot_prompt"],
                valid_character_ids,
                scene_name,
                normalized["scene_description"],
                character_action,
            )
        normalized["start_frame_prompt"] = start_frame_prompt
        normalized["end_frame_prompt"] = end_frame_prompt
        return normalized

    def _rebalance_shot_durations(self, shots: list[dict], total_duration: int) -> list[dict]:
        if not shots:
            return shots
        total_duration = max(total_duration, len(shots) * 2)
        count = len(shots)
        base = max(2, total_duration // count)
        remainder = total_duration - (base * count)
        for index, shot in enumerate(shots):
            shot["duration_seconds"] = base + (1 if index < remainder else 0)
        return shots

    # --- TextProvider ---

    def generate_story(self, title, prompt, style, duration_seconds, characters=None, scenes=None):
        char_names = ",".join(c["name"] for c in (characters or [])) if characters else "主角"
        scene_names = ",".join(s["name"] for s in (scenes or [])) if scenes else "核心场景"

        system = self._p("prompt_generate_story_system")
        user = self._p("prompt_generate_story_user").format(
            title=title, prompt=prompt, style=style,
            duration_seconds=duration_seconds,
            char_names=char_names, scene_names=scene_names,
        )
        return self._chat(system, user, timeout=300)

    def rewrite_story(self, original_story, rewrite_direction, style, characters=None, scenes=None):
        char_names = ",".join(c["name"] for c in (characters or [])) if characters else "主角"
        scene_names = ",".join(s["name"] for s in (scenes or [])) if scenes else "核心场景"

        system = self._p("prompt_rewrite_system")
        user = self._p("prompt_rewrite_user").format(
            original_story=original_story,
            rewrite_direction=rewrite_direction,
            style=style,
            char_names=char_names,
            scene_names=scene_names,
        )
        return self._chat(system, user, timeout=300)

    def expand_story_beats(self, story, style, duration_seconds, characters=None, scenes=None):
        char_names = ",".join(c["name"] for c in (characters or [])) if characters else "主角"
        scene_names = ",".join(s["name"] for s in (scenes or [])) if scenes else "核心场景"
        system = self._p("prompt_expand_story_beats_system")
        user = self._p("prompt_expand_story_beats_user").format(
            story=story,
            style=style,
            duration_seconds=duration_seconds,
            char_names=char_names,
            scene_names=scene_names,
        )
        return self._chat(system, user, timeout=300)

    def expand_story_screenplay(self, story, style, duration_seconds, characters=None, scenes=None):
        char_names = ",".join(c["name"] for c in (characters or [])) if characters else "主角"
        scene_names = ",".join(s["name"] for s in (scenes or [])) if scenes else "核心场景"
        system = self._p("prompt_expand_story_screenplay_system")
        user = self._p("prompt_expand_story_screenplay_user").format(
            story=story,
            style=style,
            duration_seconds=duration_seconds,
            char_names=char_names,
            scene_names=scene_names,
        )
        return self._chat(system, user, timeout=300)

    def split_story_into_shots(self, story, duration_seconds, characters=None, scenes=None):
        system = self._p("prompt_split_shots_system")

        # Format character list
        char_lines = []
        for c in (characters or []):
            name = c.get("name", "")
            appearance = c.get("appearance_prompt", "")
            char_lines.append(f"- {name}：{appearance}")
        character_list = "\n".join(char_lines) if char_lines else "（无）"

        # Format scene list
        scene_lines = []
        for s in (scenes or []):
            name = s.get("name", "")
            desc = s.get("description", "")
            scene_lines.append(f"- {name}：{desc}")
        scene_list = "\n".join(scene_lines) if scene_lines else "（无）"

        user = self._p("prompt_split_shots_user").format(
            story=story, duration_seconds=duration_seconds,
            character_list=character_list, scene_list=scene_list,
        )
        try:
            raw = self._chat(system, user, timeout=self._config.request_timeout)
        except RuntimeError:
            raw = ""
        char_names = [c.get("name", "") for c in (characters or []) if c.get("name")]
        scene_names = [s.get("name", "") for s in (scenes or []) if s.get("name")]
        if raw:
            try:
                start = raw.find("[")
                end = raw.rfind("]") + 1
                if start >= 0 and end > start:
                    shots = json.loads(raw[start:end])
                    if isinstance(shots, list):
                        normalized_shots = []
                        default_duration = max(2, duration_seconds // max(len(shots), 1))
                        for index, shot in enumerate(shots, start=1):
                            if isinstance(shot, dict):
                                normalized_shots.append(
                                    self._normalize_shot(
                                        shot,
                                        default_duration,
                                        index,
                                        char_names,
                                        scene_names,
                                    )
                                )
                        if normalized_shots:
                            return self._rebalance_shot_durations(normalized_shots, duration_seconds)
            except (json.JSONDecodeError, IndexError):
                pass
        # Fallback: simple splitting by paragraphs
        raw_parts = [part.strip() for part in story.split("\n\n") if part.strip()]
        if not raw_parts:
            raw_parts = [story.strip() or "No content"]
        desired_count = max(6, min(20, len(raw_parts) * 3))
        max_count = max(1, duration_seconds // 2)
        shot_count = max(1, min(desired_count, max_count))
        shots = []
        for i in range(shot_count):
            source = raw_parts[i % len(raw_parts)]
            cameras = ["远景", "中景", "特写", "跟拍", "过肩镜头", "航拍"]
            movements = ["缓慢推进", "轻柔横摇", "手持晃动", "固定镜头", "推拉变焦", "稳定跟随"]
            scene_name = scene_names[0] if scene_names else ""
            chosen_characters = char_names[:1] if char_names else []
            shot_prompt = f"{source}，电影级{cameras[i % len(cameras)]}，{movements[i % len(movements)]}，光线明确，氛围集中。"
            shots.append({
                "shot_title": f"镜头 {i + 1}",
                "shot_description": source,
                "shot_prompt": shot_prompt,
                "start_frame_prompt": self._build_frame_prompt_fallback("start", shot_prompt, chosen_characters, scene_name),
                "end_frame_prompt": self._build_frame_prompt_fallback("end", shot_prompt, chosen_characters, scene_name),
                "duration_seconds": 2,
                "character_action": f"{'、'.join(chosen_characters) if chosen_characters else '主体'}在{scene_name or '当前场景'}中执行：{source[:40] if len(source) > 40 else source}",
                "character_ids": chosen_characters,
                "scene_name": scene_name,
                "scene_description": source,
                "camera_movement": ["推", "拉", "摇", "移", "跟", "固定"][i % 6],
                "emotion_keywords": "",
                "narration_text": self._infer_narration_text(
                    source,
                    shot_prompt,
                    f"{'、'.join(chosen_characters) if chosen_characters else '主体'}在{scene_name or '当前场景'}中执行：{source[:40] if len(source) > 40 else source}",
                    "",
                    chosen_characters,
                ),
            })
        return self._rebalance_shot_durations(shots, duration_seconds)

    def generate_characters(self, story, style):
        system = self._p("prompt_generate_characters_system")
        user = self._p("prompt_generate_characters_user").format(
            story=story, style=style,
        )
        raw = self._chat(system, user, timeout=300)
        try:
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start >= 0 and end > start:
                chars = json.loads(raw[start:end])
                if isinstance(chars, list):
                    return chars
        except (json.JSONDecodeError, IndexError):
            pass
        # Fallback: extract character-like keywords from story
        keywords = ["主角", "年轻人", "宇航员", "舞者", "渔夫", "飞行员", "猫咪", "机器人", "厨师", "画家", "探险家", "潜水员"]
        found = [kw for kw in keywords if kw in story] or ["主角"]
        personalities = ["勇敢", "冷静", "热情", "内敛", "果断", "温柔", "神秘", "幽默"]
        return [{"name": n, "appearance_prompt": f"{n}外观描述，{style}风格", "personality_tags": personalities[i % len(personalities)], "voice_profile": "标准普通话"} for i, n in enumerate(found)]

    def generate_scenes(self, story, style):
        system = self._p("prompt_generate_scenes_system")
        user = self._p("prompt_generate_scenes_user").format(
            story=story, style=style,
        )
        raw = self._chat(system, user, timeout=300)
        try:
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start >= 0 and end > start:
                scenes = json.loads(raw[start:end])
                if isinstance(scenes, list):
                    return scenes
        except (json.JSONDecodeError, IndexError):
            pass
        # Fallback: extract scene-like keywords from story
        keywords = ["城市", "森林", "海", "山", "房间", "街道", "天空", "沙漠", "雪山", "深海", "废墟", "图书馆", "画室", "花园", "舞台", "飞船", "火车"]
        found = [kw for kw in keywords if kw in story] or ["核心场景"]
        return [{"name": f"{s}场景", "description": f"{style}风格的{s}环境", "reference_image_path": None} for s in found]

    # --- ImageProvider ---

    def generate_frame(self, shot_id, shot_title, shot_prompt, frame_type, character_appearance="", scene_description="", character_image_paths=None, scene_image_path="", start_frame_prompt="", end_frame_prompt="", character_names=None, aspect_ratio="16:9"):
        import base64
        if character_image_paths is None:
            character_image_paths = []
        if character_names is None:
            character_names = []
        # Build reference images: characters first, scene last
        ref_images = []
        image_labels = []  # list of (label, description)
        idx = 0
        for i, char_img in enumerate(character_image_paths):
            if char_img:
                full_path = ASSETS_DIR / char_img
                if full_path.exists():
                    b64 = base64.b64encode(full_path.read_bytes()).decode()
                    ref_images.append(f"data:image/png;base64,{b64}")
                    idx += 1
                    name = character_names[i] if i < len(character_names) else "角色"
                    image_labels.append((self._ordinal_label(idx), name))
        if scene_image_path:
            full_path = ASSETS_DIR / scene_image_path
            if full_path.exists():
                b64 = base64.b64encode(full_path.read_bytes()).decode()
                ref_images.append(f"data:image/png;base64,{b64}")
                idx += 1
                image_labels.append((self._ordinal_label(idx), scene_description or "场景环境"))

        # Build prompt: use frame-specific prompt if available, fall back to shot_prompt
        if frame_type == "start" and start_frame_prompt:
            frame_shot_prompt = start_frame_prompt
        elif frame_type == "end" and end_frame_prompt:
            frame_shot_prompt = end_frame_prompt
        else:
            frame_shot_prompt = shot_prompt

        # Build prompt: natural language style per seedream docs
        character_names_text = "、".join(character_names) if character_names else "未指定角色"
        reference_notes = "；".join(f"{label}={desc}" for label, desc in image_labels) if image_labels else "无参考图"
        base_prompt = self._p("prompt_generate_frame").format(
            frame_type=frame_type,
            frame_type_upper=frame_type.upper(),
            shot_prompt=frame_shot_prompt,
            scene_description=scene_description or "未指定场景",
            character_names=character_names_text,
            reference_notes=reference_notes,
        )

        if image_labels:
            ref_text = "，".join(f"{label}为{desc}" for label, desc in image_labels)
            enhanced_prompt = f"{ref_text}。{base_prompt}"
        else:
            enhanced_prompt = base_prompt

        payload = {
            "model": self._config.image_model,
            "prompt": enhanced_prompt,
            "size": self._image_size_for_aspect_ratio(aspect_ratio),
            "n": 1,
        }
        if ref_images:
            payload["image"] = ref_images if len(ref_images) > 1 else ref_images[0]
        data = self._request("POST", f"{self._base_url}/v1/images/generations", payload)
        image_url = data["data"][0]["url"]
        filename = f"shot_{shot_id}_{frame_type}.png"
        return download_asset(image_url, filename, ASSETS_DIR)

    def generate_character_image(self, char_id: int, appearance_prompt: str, style: str) -> str:
        prompt = f"全身角色参考图，{style}风格：{appearance_prompt}。全身从头到脚，站立姿势，纯色背景（白色或浅灰色），均匀摄影棚灯光，完整角色可见，无裁剪，详细服装和比例，电影级品质，8K分辨率。"
        data = self._request("POST", f"{self._base_url}/v1/images/generations", {
            "model": self._config.image_model,
            "prompt": prompt,
            "size": self._image_size_for_aspect_ratio("16:9"),
            "n": 1,
        })
        image_url = data["data"][0]["url"]
        filename = f"character_{char_id}.png"
        return download_asset(image_url, filename, ASSETS_DIR)

    def generate_scene_image(self, scene_id: int, description: str, style: str) -> str:
        prompt = f"场景环境，{style}风格：{description}。透视感氛围，体积光，细腻纹理，电影级构图，8K分辨率。"
        data = self._request("POST", f"{self._base_url}/v1/images/generations", {
            "model": self._config.image_model,
            "prompt": prompt,
            "size": self._image_size_for_aspect_ratio("16:9"),
            "n": 1,
        })
        image_url = data["data"][0]["url"]
        filename = f"scene_{scene_id}.png"
        return download_asset(image_url, filename, ASSETS_DIR)

    # --- VideoProvider ---

    def generate_video(self, shot_id, shot_title, shot_prompt, start_frame_path="", end_frame_path="", narration_text="", character_names=None, scene_description="", character_image_paths=None, scene_image_path="", aspect_ratio="16:9", duration=8, reference_image_paths=None, resolution="720p", model=None):
        import base64
        if character_names is None:
            character_names = []
        if narration_text.strip():
            sound_instruction = ""
        else:
            sound_instruction = "Sound: no human voice, no dialogue, no speech."

        continuity_notes = (
            "Use the provided first frame and last frame as continuity anchors. "
            "Keep the same subject identity, wardrobe, scene layout, lighting direction, and key props throughout the shot."
        )
        video_prompt = self._p("prompt_generate_video").format(
            shot_title=shot_title,
            shot_prompt=shot_prompt,
            scene_description=scene_description or "未指定场景",
            character_names="、".join(character_names) if character_names else "未指定角色",
            continuity_notes=continuity_notes,
            narration_text=narration_text or "无旁白",
            sound_instruction=sound_instruction,
        )

        model = model or self._config.video_model
        is_seedance = model.startswith("doubao-seedance")
        is_kling = model.startswith("kling")

        if is_kling:
            # Kling: model_name + image/image_tail format
            payload = self._build_kling_payload(model, video_prompt, aspect_ratio, duration,
                                                start_frame_path, end_frame_path,
                                                scene_image_path, character_image_paths,
                                                reference_image_paths or [], resolution=resolution)
        elif is_seedance:
            # Seedance: content[] array format with first_frame/last_frame roles
            payload = self._build_seedance_payload(model, video_prompt, aspect_ratio, duration,
                                                   start_frame_path, end_frame_path,
                                                   reference_image_paths or [])
        else:
            # Grok / xAI: prompt + image + reference_images format
            payload = self._build_xai_payload(model, video_prompt, aspect_ratio, duration,
                                              start_frame_path, end_frame_path,
                                              scene_image_path, character_image_paths,
                                              reference_image_paths or [], resolution=resolution)

        import json as _json, sys as _sys
        def _trunc(v):
            if isinstance(v, str) and len(v) > 200:
                return v[:200] + f"...[{len(v)} chars]"
            if isinstance(v, dict):
                return {k: _trunc(x) for k, x in v.items()}
            if isinstance(v, list):
                return [_trunc(x) for x in v]
            return v
        _sys.stderr.write(f"\n[VIDEO API REQUEST]\n{_json.dumps(_trunc(payload), ensure_ascii=False, indent=2)}\n\n")
        _sys.stderr.flush()

        result = self._request("POST", f"{self._base_url}/v1/video/generations", payload)

        task_id = result.get("request_id") or result.get("id") or result.get("task_id")
        if not task_id:
            raise RuntimeError(f"Video generation did not return task_id: {result}")

        # Poll for completion
        poll_url = f"{self._base_url}/v1/video/task/{task_id}"
        max_polls = self._config.request_timeout // self._config.poll_interval
        for _ in range(max(max_polls, 1)):
            time.sleep(self._config.poll_interval)
            task_data = self._request("GET", poll_url)
            status = task_data.get("status", "")
            if status in ("done", "completed", "succeeded"):
                video_obj = task_data.get("video") or {}
                video_url = video_obj.get("url") or ""
                if not video_url:
                    content = task_data.get("content") or {}
                    video_url = content.get("video_url") or ""
                if video_url:
                    filename = f"shot_{shot_id}_video.mp4"
                    return download_asset(video_url, filename, ASSETS_DIR)
                raise RuntimeError(f"Video completed but no URL: {task_data}")
            if status in ("failed", "error") or task_data.get("error"):
                err = task_data.get("error") or {}
                if isinstance(err, dict):
                    raise RuntimeError(f"Video generation failed: {err.get('code', '')} - {err.get('message', '')}")
                raise RuntimeError(f"Video generation failed: {err}")

        raise RuntimeError(f"Video generation timed out after {self._config.request_timeout}s")

    def _build_xai_payload(self, model, video_prompt, aspect_ratio, duration,
                           start_frame_path, end_frame_path,
                           scene_image_path="", character_image_paths=None,
                           reference_image_paths=None, resolution="720p"):
        """xAI/Grok format: prompt + image + reference_images."""
        import base64
        payload = {
            "model": model,
            "prompt": video_prompt,
            "aspect_ratio": aspect_ratio,
            "duration": min(max(int(duration), 1), 300),
            "providerOptions": {"xai": {"resolution": resolution}},
        }
        if start_frame_path:
            img_path = ASSETS_DIR / start_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                payload["image"] = {"url": f"data:image/png;base64,{b64}"}
        ref_images = []
        if end_frame_path:
            img_path = ASSETS_DIR / end_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                ref_images.append({"url": f"data:image/png;base64,{b64}"})
        if scene_image_path:
            img_path = ASSETS_DIR / scene_image_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                ref_images.append({"url": f"data:image/png;base64,{b64}"})
        if character_image_paths:
            for cpath in character_image_paths:
                img_path = ASSETS_DIR / cpath
                if img_path.exists():
                    b64 = base64.b64encode(img_path.read_bytes()).decode()
                    ref_images.append({"url": f"data:image/png;base64,{b64}"})
        if reference_image_paths:
            for rpath in reference_image_paths:
                from pathlib import Path as _P
                img_path = _P(rpath)
                if img_path.exists():
                    b64 = base64.b64encode(img_path.read_bytes()).decode()
                    ref_images.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}, "role": "first_frame"})
        if ref_images:
            payload["reference_images"] = ref_images
        return payload

    def _build_seedance_payload(self, model, video_prompt, aspect_ratio, duration,
                                start_frame_path, end_frame_path,
                                reference_image_paths=None):
        """Seedance/豆包 format: content[] array with first_frame/last_frame/reference_image roles."""
        import base64
        content = [{"type": "text", "text": video_prompt}]
        if start_frame_path:
            img_path = ASSETS_DIR / start_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}, "role": "first_frame"})
        if end_frame_path:
            img_path = ASSETS_DIR / end_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}, "role": "last_frame"})
        if reference_image_paths:
            for rpath in reference_image_paths[:4]:
                from pathlib import Path as _P
                img_path = _P(rpath)
                if img_path.exists():
                    b64 = base64.b64encode(img_path.read_bytes()).decode()
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}, "role": "first_frame"})
        return {
            "model": model,
            "content": content,
            "aspect_ratio": aspect_ratio,
            "duration": min(max(int(duration), 1), 300),
        }

    def _build_kling_payload(self, model, video_prompt, aspect_ratio, duration,
                              start_frame_path, end_frame_path,
                              scene_image_path="", character_image_paths=None,
                              reference_image_paths=None, resolution="720p"):
        """Kling format: model_name + image/image_tail + mode/watermark_info."""
        import base64
        # Map resolution to Kling mode
        mode_map = {"480p": "std", "720p": "std", "1080p": "pro", "4k": "4k"}
        mode = mode_map.get(resolution, "std")
        # Duration: Kling accepts "3"-"15" as string
        dur = min(max(int(duration), 3), 15)

        payload = {
            "model": model,
            "model_name": model,
            "prompt": video_prompt,
            "aspect_ratio": aspect_ratio,
            "duration": str(dur),
            "mode": mode,
            "watermark_info": {"enabled": False},
            "sound": "off",
        }

        # Image (start frame)
        if start_frame_path:
            img_path = ASSETS_DIR / start_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                payload["image"] = b64

        # Image tail (end frame)
        if end_frame_path:
            img_path = ASSETS_DIR / end_frame_path
            if img_path.exists():
                b64 = base64.b64encode(img_path.read_bytes()).decode()
                payload["image_tail"] = b64

        # If no start_frame, try scene/character/reference images as start frame
        if "image" not in payload:
            for path_source in ([scene_image_path] if scene_image_path else []) + \
                               (character_image_paths or []) + \
                               (reference_image_paths or []):
                from pathlib import Path as _P
                img_path = ASSETS_DIR / path_source if not _P(path_source).is_absolute() else _P(path_source)
                if img_path.exists():
                    b64 = base64.b64encode(img_path.read_bytes()).decode()
                    payload["image"] = b64
                    break

        return payload

    # --- Internal ---

    def _chat(self, system: str, user: str, timeout: int | None = None) -> str:
        payload = {
            "model": self._config.text_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": self._config.max_tokens,
            "temperature": self._config.temperature,
        }
        url = f"{self._base_url}/v1/chat/completions"
        data = self._request("POST", url, payload, timeout=timeout)
        return data["choices"][0]["message"]["content"]

    def chat_stream(self, messages: list[dict], system_prompt: str):
        """Stream chat completions, yielding content delta strings."""
        payload = {
            "model": self._config.text_model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "max_tokens": self._config.max_tokens,
            "temperature": self._config.temperature,
            "stream": True,
        }
        url = f"{self._base_url}/v1/chat/completions"
        retries = self._config.max_retries
        _timeout = self._config.request_timeout
        for attempt in range(retries + 1):
            try:
                resp = requests.post(
                    url, json=payload, headers=self._headers,
                    timeout=_timeout, stream=True,
                )
                if resp.status_code >= 500 and attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                if not resp.ok:
                    raise RuntimeError(f"API error {resp.status_code}: {resp.text[:500]}")
                for line in resp.iter_lines(decode_unicode=True):
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[len("data: "):]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                return
            except requests.exceptions.Timeout:
                raise RuntimeError(f"The read operation timed out (after {_timeout}s)")
            except requests.exceptions.ConnectionError as e:
                if attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"Connection error: {e}") from e
        raise RuntimeError("Max retries exceeded")

    def _request(self, method: str, url: str, json_body=None, timeout: int | None = None) -> dict:
        retries = self._config.max_retries
        _timeout = timeout or self._config.request_timeout
        for attempt in range(retries + 1):
            try:
                resp = requests.request(
                    method, url, json=json_body, headers=self._headers, timeout=_timeout,
                )
                if resp.status_code >= 500 and attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                if not resp.ok:
                    raise RuntimeError(f"API error {resp.status_code}: {resp.text[:500]}")
                return resp.json()
            except requests.exceptions.Timeout as e:
                raise RuntimeError(f"The read operation timed out (after {_timeout}s)")
            except requests.exceptions.ConnectionError as e:
                if attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"Connection error: {e}") from e
        raise RuntimeError("Max retries exceeded")
