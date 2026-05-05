from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class BatchRepository:
    """Repository for shot generation batches (versions)."""

    def create_batch(self, episode_id: int, task_id: int | None, shot_count: int = 0) -> int:
        conn = self.get_connection()
        try:
            version_no = conn.execute(
                "SELECT COALESCE(MAX(version_no), 0) + 1 FROM shot_batches WHERE episode_id = ?",
                (episode_id,),
            ).fetchone()[0]
            ts = now_iso()
            cur = conn.execute(
                """
                INSERT INTO shot_batches (episode_id, version_no, task_id, shot_count, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (episode_id, version_no, task_id, shot_count, ts),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def get_batch(self, batch_id: int) -> dict | None:
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM shot_batches WHERE id = ?", (batch_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def list_batches(self, episode_id: int) -> list[dict]:
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM shot_batches WHERE episode_id = ? ORDER BY version_no DESC",
                (episode_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def get_connection(self):
        return get_connection()
