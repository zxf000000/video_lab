from __future__ import annotations

from ..common import now_iso, row_to_dict, rows_to_dicts
from ...db import get_connection


class ProjectsRepository:
    """Repository boundary for project-level reads and writes."""

    def create(self, payload: dict) -> int:
        ts = now_iso()
        conn = self.get_connection()
        try:
            legacy_title = payload["name"]
            legacy_story_prompt = payload.get("logline", "")
            legacy_style = payload.get("genre", "")
            legacy_aspect_ratio = "9:16"
            legacy_target_duration = max(1, int(payload.get("episode_count_planned", 30))) * 60
            cur = conn.execute(
                """
                INSERT INTO projects (
                    title, story_prompt, style, aspect_ratio, target_duration,
                    name, genre, target_platform, episode_count_planned,
                    current_stage, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    legacy_title,
                    legacy_story_prompt,
                    legacy_style,
                    legacy_aspect_ratio,
                    legacy_target_duration,
                    payload["name"],
                    payload["genre"],
                    payload["target_platform"],
                    payload["episode_count_planned"],
                    payload["current_stage"],
                    payload["status"],
                    ts,
                    ts,
                ),
            )
            project_id = int(cur.lastrowid)
            conn.execute(
                """
                INSERT INTO project_briefs (
                    project_id, logline, target_audience, genre_tags, style_keywords,
                    world_rules, main_conflict, relationship_summary,
                    reversal_rules, forbidden_rules, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    payload.get("logline", ""),
                    payload.get("target_audience", ""),
                    payload.get("genre_tags", "[]"),
                    payload.get("style_keywords", "[]"),
                    payload.get("world_rules", ""),
                    payload.get("main_conflict", ""),
                    payload.get("relationship_summary", ""),
                    payload.get("reversal_rules", ""),
                    payload.get("forbidden_rules", ""),
                    payload.get("brief_status", "draft"),
                    ts,
                ),
            )
            conn.commit()
            return project_id
        finally:
            conn.close()

    def get(self, project_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def list(self):
        conn = self.get_connection()
        try:
            rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC, id DESC").fetchall()
            return rows_to_dicts(rows)
        finally:
            conn.close()

    def delete(self, project_id: int) -> None:
        conn = self.get_connection()
        try:
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
        finally:
            conn.close()

    def update(self, project_id: int, payload: dict) -> None:
        fields = []
        values = []
        for key in (
            "name",
            "genre",
            "target_platform",
            "episode_count_planned",
            "current_stage",
            "status",
        ):
            if key in payload:
                fields.append(f"{key} = ?")
                values.append(payload[key])
        if "name" in payload:
            fields.append("title = ?")
            values.append(payload["name"])
        if not fields:
            return
        values.extend([now_iso(), project_id])
        conn = self.get_connection()
        try:
            conn.execute(
                f"UPDATE projects SET {', '.join(fields)}, updated_at = ? WHERE id = ?",
                values,
            )
            conn.commit()
        finally:
            conn.close()

    def get_brief(self, project_id: int):
        conn = self.get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM project_briefs WHERE project_id = ?",
                (project_id,),
            ).fetchone()
            return row_to_dict(row)
        finally:
            conn.close()

    def upsert_brief(self, project_id: int, payload: dict) -> None:
        ts = now_iso()
        conn = self.get_connection()
        try:
            exists = conn.execute(
                "SELECT id FROM project_briefs WHERE project_id = ?",
                (project_id,),
            ).fetchone()
            if exists:
                conn.execute(
                    """
                    UPDATE project_briefs
                    SET logline = ?, target_audience = ?, genre_tags = ?, style_keywords = ?,
                        world_rules = ?, main_conflict = ?, relationship_summary = ?,
                        reversal_rules = ?, forbidden_rules = ?, status = ?, updated_at = ?
                    WHERE project_id = ?
                    """,
                    (
                        payload["logline"],
                        payload["target_audience"],
                        payload["genre_tags"],
                        payload["style_keywords"],
                        payload["world_rules"],
                        payload["main_conflict"],
                        payload["relationship_summary"],
                        payload["reversal_rules"],
                        payload["forbidden_rules"],
                        payload["status"],
                        ts,
                        project_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO project_briefs (
                        project_id, logline, target_audience, genre_tags, style_keywords,
                        world_rules, main_conflict, relationship_summary,
                        reversal_rules, forbidden_rules, status, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        payload["logline"],
                        payload["target_audience"],
                        payload["genre_tags"],
                        payload["style_keywords"],
                        payload["world_rules"],
                        payload["main_conflict"],
                        payload["relationship_summary"],
                        payload["reversal_rules"],
                        payload["forbidden_rules"],
                        payload["status"],
                        ts,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

    def get_connection(self):
        return get_connection()
