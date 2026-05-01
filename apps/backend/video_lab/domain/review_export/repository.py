from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class ReviewExportRepository:
    """Repository boundary for review issues and episode exports."""

    def get_connection(self):
        return get_connection()

    def list_review_issues(self, episode_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM review_issues WHERE episode_id = ? ORDER BY id DESC",
                (episode_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def create_review_issue(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO review_issues (
                    project_id, episode_id, shot_id, generation_task_id, issue_type,
                    severity, description, rework_target_type, resolution_status,
                    created_at, resolved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["project_id"],
                    payload.get("episode_id"),
                    payload.get("shot_id"),
                    payload.get("generation_task_id"),
                    payload["issue_type"],
                    payload["severity"],
                    payload["description"],
                    payload["rework_target_type"],
                    payload["resolution_status"],
                    ts,
                    payload.get("resolved_at"),
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def get_review_issue(self, issue_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM review_issues WHERE id = ?", (issue_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def update_review_issue(self, issue_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in ("issue_type", "severity", "description", "rework_target_type", "resolution_status", "resolved_at"):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        values.append(issue_id)
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE review_issues SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def list_episode_exports(self, episode_id: int):
        conn = self.get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM episode_exports WHERE episode_id = ? ORDER BY version_no DESC, id DESC",
                (episode_id,),
            ).fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def create_episode_export(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                """
                INSERT INTO episode_exports (
                    episode_id, version_no, selected_task_ids, timeline_data, subtitle_data,
                    audio_data, preview_url, export_url, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["episode_id"],
                    payload["version_no"],
                    payload["selected_task_ids"],
                    payload["timeline_data"],
                    payload["subtitle_data"],
                    payload["audio_data"],
                    payload["preview_url"],
                    payload["export_url"],
                    payload["status"],
                    ts,
                    ts,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def get_episode_export(self, export_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM episode_exports WHERE id = ?", (export_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def get_next_export_version_no(self, episode_id: int) -> int:
        conn = self.get_connection()
        try:
            row = conn.execute(
                "SELECT COALESCE(MAX(version_no), 0) AS max_version FROM episode_exports WHERE episode_id = ?",
                (episode_id,),
            ).fetchone()
            return int(row["max_version"]) + 1
        finally:
            conn.close()

    def update_episode_export(self, export_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "selected_task_ids",
            "timeline_data",
            "subtitle_data",
            "audio_data",
            "preview_url",
            "export_url",
            "status",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if not fields:
            return
        fields.append("updated_at = ?")
        values.append(now_iso())
        values.append(export_id)
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE episode_exports SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()
