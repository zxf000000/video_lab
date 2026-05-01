from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


class CharacterProfilePayload(TypedDict):
    name: str
    role_type: str
    identity_summary: str
    appearance_summary: str
    personality_tags: list[str]
    speech_style: str
    negative_constraints: str


class CharacterImageSpecPayload(TypedDict):
    gender_presentation: str
    age_range: str
    body_type: str
    face_features: str
    hair_style: str
    hair_color: str
    eye_style: str
    signature_expression: str
    signature_pose: str
    clothing_style: str
    color_palette: list[str]
    visual_keywords: list[str]
    negative_visual_constraints: list[str]
    image_prompt: str
    negative_prompt: str


class CharacterProposalPayload(TypedDict):
    character_profile: CharacterProfilePayload
    image_spec: CharacterImageSpecPayload


class CharacterCollectionProposalPayload(TypedDict):
    mode: Literal["base_character"]
    roles: list[CharacterProposalPayload]


class CharacterVariantInheritRulesPayload(TypedDict):
    keep_face_identity: bool
    keep_age_range: bool
    keep_body_type: bool
    keep_core_temperament: bool


class CharacterVariantImageSpecOverridePayload(TypedDict):
    gender_presentation: NotRequired[str]
    age_range: NotRequired[str]
    body_type: NotRequired[str]
    face_features: NotRequired[str]
    hair_style: NotRequired[str]
    hair_color: NotRequired[str]
    eye_style: NotRequired[str]
    signature_expression: NotRequired[str]
    signature_pose: NotRequired[str]
    clothing_style: NotRequired[str]
    color_palette: NotRequired[list[str]]
    visual_keywords: NotRequired[list[str]]
    negative_visual_constraints: NotRequired[list[str]]
    image_prompt: NotRequired[str]
    negative_prompt: NotRequired[str]


class CharacterVariantProposalPayload(TypedDict):
    variant_name: str
    variant_type: str
    trigger_reason: str
    visual_changes_summary: str
    inherit_rules: CharacterVariantInheritRulesPayload
    image_spec_override: CharacterVariantImageSpecOverridePayload


class CharacterVariantCollectionProposalPayload(TypedDict):
    mode: Literal["character_variant"]
    base_character: CharacterProposalPayload | None
    variants: list[CharacterVariantProposalPayload]


CharacterCopilotProposalPayload = CharacterCollectionProposalPayload | CharacterVariantCollectionProposalPayload
