from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class GenerationRepository:
    """Repository boundary for generation tasks and generated outputs."""

    def get_connection(self):
        return get_connection()

    def create_task(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO generation_tasks (
                    project_id, episode_id, shot_id, shot_prompt_id, provider, model_name,
                    status, input_payload, output_assets, retry_count, error_message,
                    cost_amount, duration_ms, submitted_at, finished_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload.get("episode_id"),
                    payload.get("shot_id"),
                    payload.get("shot_prompt_id"),
                    payload["provider"],
                    payload["model_name"],
                    payload["status"],
                    payload["input_payload"],
                    payload["output_assets"],
                    payload["retry_count"],
                    payload["error_message"],
                    payload["cost_amount"],
                    payload["duration_ms"],
                    ts,
                    payload.get("finished_at"),
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def get_task(self, task_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM generation_tasks WHERE id = ?", (task_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def list_tasks_for_episode(self, episode_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM generation_tasks WHERE episode_id = ? ORDER BY id DESC",
                (episode_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def list_tasks_for_project(self, project_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM generation_tasks WHERE project_id = ? ORDER BY id DESC",
                (project_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def update_task(self, task_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "provider",
            "model_name",
            "status",
            "input_payload",
            "output_assets",
            "retry_count",
            "error_message",
            "cost_amount",
            "duration_ms",
            "finished_at",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.append(task_id)
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE generation_tasks SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()
