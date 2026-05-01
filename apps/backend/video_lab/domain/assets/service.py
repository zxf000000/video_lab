from __future__ import annotations

import json

from ...services import _get_providers
from ..common import DomainError, normalize_int, normalize_json_text, normalize_text
from .repository import AssetsRepository


class AssetsService:
    """Application service for role and scene asset management."""

    def __init__(self, repository: AssetsRepository | None = None) -> None:
        self.repository = repository or AssetsRepository()

    def upsert_character(self, project_id: int, payload: dict) -> int:
        data = {
            "project_id": project_id,
            "name": normalize_text(payload.get("name")),
            "role_type": normalize_text(payload.get("role_type")),
            "identity_summary": normalize_text(payload.get("identity_summary")),
            "appearance_summary": normalize_text(payload.get("appearance_summary")),
            "personality_tags": normalize_json_text(payload.get("personality_tags"), []),
            "speech_style": normalize_text(payload.get("speech_style")),
            "visual_profile": normalize_json_text(payload.get("visual_profile"), {}),
            "image_prompt": normalize_text(payload.get("image_prompt")),
            "negative_prompt": normalize_text(payload.get("negative_prompt")),
            "image_path": normalize_text(payload.get("image_path")),
            "voice_profile": normalize_json_text(payload.get("voice_profile"), {}),
            "outfit_presets": normalize_json_text(payload.get("outfit_presets"), []),
            "negative_constraints": normalize_text(payload.get("negative_constraints")),
            "reference_asset_ids": normalize_json_text(payload.get("reference_asset_ids"), []),
            "status": normalize_text(payload.get("status"), "draft"),
            "version_no": max(1, normalize_int(payload.get("version_no"), 1)),
        }
        if not data["name"]:
            raise DomainError("character name is required")
        character_id = payload.get("id")
        if character_id:
            existing = self.repository.get_character(int(character_id))
            if not existing or int(existing["project_id"]) != project_id:
                raise DomainError("character not found")
            self.repository.update_character(int(character_id), data)
            return int(character_id)
        return self.repository.create_character(data)

    def upsert_scene_preset(self, project_id: int, payload: dict) -> int:
        data = {
            "project_id": project_id,
            "name": normalize_text(payload.get("name")),
            "scene_type": normalize_text(payload.get("scene_type")),
            "space_description": normalize_text(payload.get("space_description")),
            "lighting_style": normalize_text(payload.get("lighting_style")),
            "time_of_day": normalize_text(payload.get("time_of_day")),
            "weather": normalize_text(payload.get("weather")),
            "prop_list": normalize_json_text(payload.get("prop_list"), []),
            "reference_asset_ids": normalize_json_text(payload.get("reference_asset_ids"), []),
            "variants": normalize_json_text(payload.get("variants"), []),
            "status": normalize_text(payload.get("status"), "draft"),
            "version_no": max(1, normalize_int(payload.get("version_no"), 1)),
        }
        if not data["name"]:
            raise DomainError("scene preset name is required")
        scene_preset_id = payload.get("id")
        if scene_preset_id:
            existing = self.repository.get_scene_preset(int(scene_preset_id))
            if not existing or int(existing["project_id"]) != project_id:
                raise DomainError("scene preset not found")
            self.repository.update_scene_preset(int(scene_preset_id), data)
            return int(scene_preset_id)
        return self.repository.create_scene_preset(data)

    def list_characters(self, project_id: int) -> list[dict]:
        return self.repository.list_characters(project_id)

    def list_scene_presets(self, project_id: int) -> list[dict]:
        return self.repository.list_scene_presets(project_id)

    def delete_character(self, character_id: int) -> None:
        existing = self.repository.get_character(character_id)
        if not existing:
            raise DomainError("character not found")
        self.repository.delete_character(character_id)

    def delete_scene_preset(self, scene_preset_id: int) -> None:
        existing = self.repository.get_scene_preset(scene_preset_id)
        if not existing:
            raise DomainError("scene preset not found")
        self.repository.delete_scene_preset(scene_preset_id)

    def generate_character_image(self, character_id: int) -> dict:
        character = self.repository.get_character(character_id)
        if not character:
            raise DomainError("character not found")
        project = self.repository.get_project(int(character["project_id"]))
        if not project:
            raise DomainError("project not found")
        brief = self.repository.get_project_brief(int(character["project_id"])) or {}
        visual_profile = self.repository.parse_json_column(character.get("visual_profile"), {})
        style_keywords = self.repository.parse_json_column(brief.get("style_keywords"), [])
        prompt_body = self._build_character_image_prompt(character, visual_profile, project, style_keywords)
        negative_prompt = normalize_text(character.get("negative_prompt"))
        providers = _get_providers()
        kling = providers.get("kling")
        if kling and hasattr(kling, "generate_image"):
            image_path = kling.generate_image(
                task_id=character_id,
                prompt=prompt_body,
                model_name="kling-v2-1",
                aspect_ratio="9:16",
                negative_prompt=negative_prompt,
            )
        else:
            image_path = providers["image"].generate_character_image(
                character_id,
                prompt_body,
                normalize_text(project.get("genre"), "cinematic"),
            )
        updated_visual_profile = self._update_variant_image_path(visual_profile, image_path)
        self.repository.update_character(
            character_id,
            {
                "image_path": image_path,
                "visual_profile": json.dumps(updated_visual_profile, ensure_ascii=False),
            },
        )
        return self.repository.get_character(character_id) or {}

    def _update_variant_image_path(self, visual_profile: dict, image_path: str) -> dict:
        if not isinstance(visual_profile, dict):
            return {"defaultImagePath": image_path}
        updated = dict(visual_profile)
        active_variant_id = normalize_text(updated.get("activeVariantId"), "default")
        if active_variant_id == "default":
            updated["defaultImagePath"] = image_path
            return updated
        raw_variants = updated.get("variants")
        if not isinstance(raw_variants, list):
            return updated
        next_variants = []
        for raw_variant in raw_variants:
            if not isinstance(raw_variant, dict):
                continue
            variant = dict(raw_variant)
            variant_id = normalize_text(variant.get("id") or variant.get("variantId"))
            if variant_id == active_variant_id:
                variant["imagePath"] = image_path
            next_variants.append(variant)
        updated["variants"] = next_variants
        return updated

    def _build_character_image_prompt(self, character: dict, visual_profile: dict, project: dict, style_keywords: list) -> str:
        explicit_prompt = normalize_text(character.get("image_prompt"))
        if explicit_prompt:
            return explicit_prompt
        segments = [
            f"现代中文短剧角色全身设定图，题材 {normalize_text(project.get('genre'), '都市短剧')}",
            normalize_text(character.get("identity_summary")),
            normalize_text(character.get("appearance_summary")),
            f"性别呈现 {normalize_text(visual_profile.get('genderPresentation'))}" if normalize_text(visual_profile.get("genderPresentation")) else "",
            f"年龄感 {normalize_text(visual_profile.get('ageRange'))}" if normalize_text(visual_profile.get("ageRange")) else "",
            f"体型 {normalize_text(visual_profile.get('bodyType'))}" if normalize_text(visual_profile.get("bodyType")) else "",
            f"脸部特征 {normalize_text(visual_profile.get('faceFeatures'))}" if normalize_text(visual_profile.get("faceFeatures")) else "",
            f"发型 {normalize_text(visual_profile.get('hairStyle'))}" if normalize_text(visual_profile.get("hairStyle")) else "",
            f"发色 {normalize_text(visual_profile.get('hairColor'))}" if normalize_text(visual_profile.get("hairColor")) else "",
            f"眼神/眼型 {normalize_text(visual_profile.get('eyeStyle'))}" if normalize_text(visual_profile.get("eyeStyle")) else "",
            f"标志表情 {normalize_text(visual_profile.get('signatureExpression'))}" if normalize_text(visual_profile.get("signatureExpression")) else "",
            f"标志姿态 {normalize_text(visual_profile.get('signaturePose'))}" if normalize_text(visual_profile.get("signaturePose")) else "",
            f"服装风格 {normalize_text(visual_profile.get('clothingStyle'))}" if normalize_text(visual_profile.get("clothingStyle")) else "",
        ]
        color_palette = visual_profile.get("colorPalette") if isinstance(visual_profile, dict) else []
        if isinstance(color_palette, list) and color_palette:
            segments.append(f"主色板 {' / '.join(str(item) for item in color_palette if str(item).strip())}")
        visual_keywords = visual_profile.get("visualKeywords") if isinstance(visual_profile, dict) else []
        if isinstance(visual_keywords, list) and visual_keywords:
            segments.append(f"视觉关键词 {' / '.join(str(item) for item in visual_keywords if str(item).strip())}")
        if isinstance(style_keywords, list) and style_keywords:
            segments.append(f"项目风格 {' / '.join(str(item) for item in style_keywords if str(item).strip())}")
        segments.extend([
            "全身从头到脚完整可见",
            "站立角色参考图",
            "纯净浅色背景",
            "均匀摄影棚灯光",
            "服装与比例细节清晰",
            "电影级质感",
            "高一致性角色设定",
        ])
        return "。".join(segment for segment in segments if segment)
