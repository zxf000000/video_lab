from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class ShotsRepository:
    """Repository boundary for episodes and shots."""

    def list_episodes(self, project_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM episodes WHERE project_id = ? ORDER BY sort_order ASC, episode_no ASC, id ASC",
                (project_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def list_shots(self, episode_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM shots WHERE episode_id = ? ORDER BY sort_order ASC, shot_no ASC, id ASC",
                (episode_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def get_episode(self, episode_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM episodes WHERE id = ?", (episode_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def create_episode(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO episodes (
                    project_id, episode_no, title, summary, goal, core_conflict,
                    opening_hook, climax, ending_hook, status, sort_order,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload["episode_no"],
                    payload["title"],
                    payload["summary"],
                    payload["goal"],
                    payload["core_conflict"],
                    payload["opening_hook"],
                    payload["climax"],
                    payload["ending_hook"],
                    payload["status"],
                    payload["sort_order"],
                    ts,
                    ts,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def update_episode(self, episode_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "episode_no",
            "title",
            "summary",
            "goal",
            "core_conflict",
            "opening_hook",
            "climax",
            "ending_hook",
            "status",
            "sort_order",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.extend([now_iso(), episode_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE episodes SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def delete_episode(self, episode_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))
            conn.commit()
        finally:
            conn.close()

    def get_shot(self, shot_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM shots WHERE id = ?", (shot_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def create_shot(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO shots (
                    project_id, episode_id, order_index, shot_title, shot_description,
                    shot_prompt, duration_seconds, status, created_at, updated_at,
                    scene_block, shot_no, visual_goal, character_ids,
                    scene_preset_id, shot_size, camera_angle, camera_motion, composition,
                    action_description, facial_emotion, dialogue_excerpt,
                    estimated_duration_ms, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload["episode_id"],
                    payload["shot_no"],
                    "",
                    "",
                    "",
                    payload["estimated_duration_ms"] // 1000,
                    payload["status"],
                    ts,
                    ts,
                    payload["scene_block"],
                    payload["shot_no"],
                    payload["visual_goal"],
                    payload["character_ids"],
                    payload.get("scene_preset_id"),
                    payload["shot_size"],
                    payload["camera_angle"],
                    payload["camera_motion"],
                    payload["composition"],
                    payload["action_description"],
                    payload["facial_emotion"],
                    payload["dialogue_excerpt"],
                    payload["estimated_duration_ms"],
                    payload["sort_order"],
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def update_shot(self, shot_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "scene_block",
            "shot_no",
            "visual_goal",
            "character_ids",
            "scene_preset_id",
            "shot_size",
            "camera_angle",
            "composition",
            "action_description",
            "facial_emotion",
            "camera_motion",
            "dialogue_excerpt",
            "estimated_duration_ms",
            "status",
            "sort_order",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.extend([now_iso(), shot_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE shots SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def delete_shot(self, shot_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute("DELETE FROM shots WHERE id = ?", (shot_id,))
            conn.commit()
        finally:
            conn.close()

    def get_connection(self):
        return get_connection()
