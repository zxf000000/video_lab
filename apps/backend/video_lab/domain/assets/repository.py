from __future__ import annotations

import json

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class AssetsRepository:
    """Repository boundary for characters and scene presets."""

    def list_characters(self, project_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM characters WHERE project_id = ? ORDER BY id ASC",
                (project_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def list_scene_presets(self, project_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM scene_presets WHERE project_id = ? ORDER BY id ASC",
                (project_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def get_character(self, character_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM characters WHERE id = ?", (character_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def get_project(self, project_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def get_project_brief(self, project_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM project_briefs WHERE project_id = ?", (project_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def parse_json_column(self, value, fallback):
        if value in (None, ""):
            return fallback
        if not isinstance(value, str):
            return value
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return fallback

    def create_character(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO characters (
                    project_id, name, role_type, identity_summary, appearance_summary, appearance_prompt, personality_tags,
                    speech_style, visual_profile, image_prompt, negative_prompt, image_path, voice_profile, outfit_presets, negative_constraints,
                    reference_asset_ids, status, image_status, version_no, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload["name"],
                    payload["role_type"],
                    payload["identity_summary"],
                    payload["appearance_summary"],
                    payload.get("appearance_prompt", ""),
                    payload["personality_tags"],
                    payload["speech_style"],
                    payload["visual_profile"],
                    payload["image_prompt"],
                    payload["negative_prompt"],
                    payload["image_path"],
                    payload["voice_profile"],
                    payload["outfit_presets"],
                    payload["negative_constraints"],
                    payload["reference_asset_ids"],
                    payload["status"],
                    payload.get("image_status", ""),
                    payload["version_no"],
                    ts,
                    ts,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def update_character(self, character_id: int, payload: dict) -> None:
        import sys
        print(f"DEBUG update_character: character_id={character_id}, payload={payload}", file=sys.stderr)
        fields = []
        values = []
        for key in (
            "name",
            "role_type",
            "identity_summary",
            "appearance_summary",
            "appearance_prompt",
            "personality_tags",
            "speech_style",
            "visual_profile",
            "image_prompt",
            "negative_prompt",
            "image_path",
            "voice_profile",
            "outfit_presets",
            "negative_constraints",
            "reference_asset_ids",
            "status",
            "image_status",
            "prompt_status",
            "anchor_status",
            "regenerate_status",
            "version_no",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.extend([now_iso(), character_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE characters SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def delete_character(self, character_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute("DELETE FROM characters WHERE id = ?", (character_id,))
            conn.commit()
        finally:
            conn.close()

    def get_scene_preset(self, scene_preset_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM scene_presets WHERE id = ?", (scene_preset_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def create_scene_preset(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO scene_presets (
                    project_id, name, scene_type, space_description, lighting_style,
                    time_of_day, weather, prop_list, negative_constraints,
                    image_prompt, negative_prompt,
                    reference_asset_ids, variants,
                    episode_id, status, version_no, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload["name"],
                    payload["scene_type"],
                    payload["space_description"],
                    payload["lighting_style"],
                    payload["time_of_day"],
                    payload["weather"],
                    payload["prop_list"],
                    payload.get("negative_constraints", ""),
                    payload.get("image_prompt", ""),
                    payload.get("negative_prompt", ""),
                    payload["reference_asset_ids"],
                    payload["variants"],
                    payload.get("episode_id"),
                    payload["status"],
                    payload["version_no"],
                    ts,
                    ts,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def update_scene_preset(self, scene_preset_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "name",
            "scene_type",
            "space_description",
            "lighting_style",
            "time_of_day",
            "weather",
            "prop_list",
            "negative_constraints",
            "image_prompt",
            "negative_prompt",
            "reference_asset_ids",
            "variants",
            "episode_id",
            "status",
            "version_no",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.extend([now_iso(), scene_preset_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE scene_presets SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def delete_scene_preset(self, scene_preset_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute("DELETE FROM scene_presets WHERE id = ?", (scene_preset_id,))
            conn.commit()
        finally:
            conn.close()

    def get_connection(self):
        return get_connection()
