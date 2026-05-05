from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class PromptsRepository:
    """Repository boundary for versioned shot prompts."""

    def list_prompts(self, shot_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM shot_prompts WHERE shot_id = ? ORDER BY version_no DESC, id DESC",
                (shot_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def get_prompt(self, prompt_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM shot_prompts WHERE id = ?", (prompt_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def get_active_prompt_for_shot(self, shot_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM shot_prompts WHERE shot_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1",
                (shot_id,),
            ).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def get_next_version_no(self, shot_id: int) -> int:
        conn = self.get_connection()
        try:
            row = conn.execute(
                "SELECT COALESCE(MAX(version_no), 0) AS max_version FROM shot_prompts WHERE shot_id = ?",
                (shot_id,),
            ).fetchone()
            return int(row["max_version"]) + 1
        finally:
            conn.close()

    def create_prompt(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO shot_prompts (
                    shot_id, version_no, prompt_text, first_frame_prompt, first_frame_negative_prompt,
                    video_prompt, video_negative_prompt,
                    negative_prompt, model_params,
                    reference_asset_ids, first_frame_url, video_url, status, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["shot_id"],
                    payload["version_no"],
                    payload["prompt_text"],
                    payload.get("first_frame_prompt", ""),
                    payload.get("first_frame_negative_prompt", ""),
                    payload.get("video_prompt", ""),
                    payload.get("video_negative_prompt", ""),
                    payload["negative_prompt"],
                    payload["model_params"],
                    payload["reference_asset_ids"],
                    payload.get("first_frame_url", ""),
                    payload.get("video_url", ""),
                    payload["status"],
                    payload["is_active"],
                    ts,
                    ts,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def update_prompt(self, prompt_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "prompt_text",
            "first_frame_prompt",
            "first_frame_negative_prompt",
            "video_prompt",
            "video_negative_prompt",
            "negative_prompt",
            "model_params",
            "reference_asset_ids",
            "first_frame_url",
            "video_url",
            "status",
            "is_active",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.extend([now_iso(), prompt_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE shot_prompts SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def get_active_prompts_for_shots(self, shot_ids: list[int]) -> dict[int, dict]:
        if not shot_ids:
            return {}
        conn = self.get_connection()
        try:
            placeholders = ",".join(["?" for _ in shot_ids])
            rows = conn.execute(
                f"SELECT * FROM shot_prompts WHERE shot_id IN ({placeholders}) AND is_active = 1",
                shot_ids,
            ).fetchall()
            result = {}
            for row in rows_to_dicts(rows):
                sid = int(row["shot_id"])
                if sid not in result:
                    result[sid] = row
            return result
        finally:
            conn.close()

    def deactivate_shot_prompts(self, shot_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute(
                "UPDATE shot_prompts SET is_active = 0, updated_at = ? WHERE shot_id = ?",
                (now_iso(), shot_id),
            )
            conn.commit()
        finally:
            conn.close()

    def get_connection(self):
        return get_connection()
