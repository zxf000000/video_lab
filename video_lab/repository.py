from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .db import get_connection


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ProjectInput:
    title: str
    story_prompt: str
    style: str
    aspect_ratio: str
    target_duration: int


def create_project(data: ProjectInput) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        cur = conn.execute(
            """
            INSERT INTO projects (
                title, story_prompt, style, aspect_ratio, target_duration,
                status, story_content, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.title,
                data.story_prompt,
                data.style,
                data.aspect_ratio,
                data.target_duration,
                "draft",
                "",
                ts,
                ts,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_project_story(project_id: int, story_content: str, status: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE projects
            SET story_content = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (story_content, status, now_iso(), project_id),
        )
        conn.commit()
    finally:
        conn.close()
    create_story_version(project_id, story_content)


def update_project_status(project_id: int, status: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
            (status, now_iso(), project_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_project_duration(project_id: int, target_duration: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE projects SET target_duration = ?, updated_at = ? WHERE id = ?",
            (target_duration, now_iso(), project_id),
        )
        conn.commit()
    finally:
        conn.close()


def create_task(project_id: int, task_type: str, shot_id: int | None = None, params: dict | None = None) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        import json as _json
        params_str = _json.dumps(params or {}, ensure_ascii=False)
        cur = conn.execute(
            """
            INSERT INTO tasks (
                project_id, shot_id, task_type, status, error_message, params, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, shot_id, task_type, "queued", "", params_str, ts, ts),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_task(task_id: int, status: str, error_message: str = "") -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE tasks
            SET status = ?, error_message = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, error_message, now_iso(), task_id),
        )
        conn.commit()
    finally:
        conn.close()


def touch_task(task_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE tasks SET updated_at = ? WHERE id = ? AND status IN ('queued', 'running')",
            (now_iso(), task_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_task_progress(task_id: int, step: str) -> None:
    import json as _json
    conn = get_connection()
    try:
        row = conn.execute("SELECT params FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row:
            params = _json.loads(row["params"] or "{}")
            params["progress_step"] = step
            conn.execute(
                "UPDATE tasks SET params = ?, updated_at = ? WHERE id = ?",
                (_json.dumps(params, ensure_ascii=False), now_iso(), task_id),
            )
            conn.commit()
    finally:
        conn.close()


def fail_stale_tasks(max_age_seconds: int = 300) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, project_id, task_type, updated_at
            FROM tasks
            WHERE status IN ('queued', 'running')
            """
        ).fetchall()
        stale = []
        for row in rows:
            try:
                updated_at = datetime.fromisoformat(row["updated_at"])
            except (TypeError, ValueError):
                continue
            if updated_at < cutoff:
                stale.append(row)

        if not stale:
            return 0

        ts = now_iso()
        for row in stale:
            conn.execute(
                """
                UPDATE tasks
                SET status = ?, error_message = ?, updated_at = ?
                WHERE id = ? AND status IN ('queued', 'running')
                """,
                ("failed", f"Task timed out after {max_age_seconds // 60} minutes without progress.", ts, row["id"]),
            )
            if row["task_type"] in {"create_project", "create_project_by_rewrite", "generate_story", "split_shots"}:
                conn.execute(
                    """
                    UPDATE projects
                    SET status = ?, updated_at = ?
                    WHERE id = ? AND status IN (
                        'generating_story', 'generating_characters',
                        'generating_scenes', 'splitting_shots'
                    )
                    """,
                    ("prompt_updated", ts, row["project_id"]),
                )
        conn.commit()
        return len(stale)
    finally:
        conn.close()


def fail_project_running_tasks(project_id: int, message: str) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """
            UPDATE tasks
            SET status = ?, error_message = ?, updated_at = ?
            WHERE project_id = ? AND status IN ('queued', 'running')
            """,
            ("failed", message, now_iso(), project_id),
        )
        conn.commit()
        return int(cur.rowcount)
    finally:
        conn.close()


def replace_project_shots(project_id: int, shots: list[dict[str, Any]], characters: list[dict[str, Any]] | None = None, scenes: list[dict[str, Any]] | None = None) -> None:
    import json as _json
    conn = get_connection()
    try:
        conn.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM shots WHERE project_id = ?", (project_id,))
        ts = now_iso()

        # Build name→id mappings
        char_name_to_id = {}
        for c in (characters or []):
            char_name_to_id[c["name"]] = c["id"]
        scene_name_to_id = {}
        for s in (scenes or []):
            scene_name_to_id[s["name"]] = s["id"]

        for index, shot in enumerate(shots, start=1):
            def _str(val):
                if isinstance(val, list):
                    return ", ".join(str(v) for v in val)
                return str(val) if val is not None else ""

            # Convert character_ids from names to DB IDs
            raw_char_ids = shot.get("character_ids", [])
            if isinstance(raw_char_ids, str):
                try:
                    raw_char_ids = _json.loads(raw_char_ids)
                except (_json.JSONDecodeError, TypeError):
                    raw_char_ids = []
            resolved_char_ids = []
            for name in (raw_char_ids if isinstance(raw_char_ids, list) else []):
                cid = char_name_to_id.get(name)
                if cid is not None:
                    resolved_char_ids.append(cid)
            char_ids_json = _json.dumps(resolved_char_ids, ensure_ascii=False)

            # Convert scene_name to scene_id
            scene_id = None
            scene_name = shot.get("scene_name", "")
            if scene_name:
                scene_id = scene_name_to_id.get(scene_name)

            conn.execute(
                """
                INSERT INTO shots (
                    project_id, order_index, shot_title, shot_description,
                    shot_prompt, duration_seconds, status,
                    character_action, scene_description, camera_movement,
                    emotion_keywords, narration_text,
                    start_frame_prompt, end_frame_prompt,
                    character_ids, scene_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    index,
                    shot["shot_title"],
                    shot["shot_description"],
                    shot["shot_prompt"],
                    shot["duration_seconds"],
                    "planned",
                    _str(shot.get("character_action", "")),
                    _str(shot.get("scene_description", "")),
                    _str(shot.get("camera_movement", "")),
                    _str(shot.get("emotion_keywords", "")),
                    _str(shot.get("narration_text", "")),
                    _str(shot.get("start_frame_prompt", "")),
                    _str(shot.get("end_frame_prompt", "")),
                    char_ids_json,
                    scene_id,
                    ts, ts,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def update_shot_frames(shot_id: int, start_frame_path: str, end_frame_path: str, status: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE shots
            SET start_frame_path = ?, end_frame_path = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (start_frame_path, end_frame_path, status, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_shot_video(shot_id: int, video_path: str, status: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE shots
            SET video_path = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (video_path, status, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_shot_prompt(shot_id: int, shot_prompt: str) -> None:
    update_shot_prompts(shot_id, {"shot_prompt": shot_prompt})


def update_shot_prompts(shot_id: int, prompt_fields: dict[str, Any], status: str = "prompt_updated") -> None:
    allowed_fields = {
        "shot_prompt",
        "start_frame_prompt",
        "end_frame_prompt",
        "video_prompt",
    }
    updates = {key: str(value) for key, value in prompt_fields.items() if key in allowed_fields}
    if not updates:
        return

    set_clauses = [f"{field} = ?" for field in updates]
    params = list(updates.values())
    set_clauses.extend(["status = ?", "updated_at = ?"])
    params.extend([status, now_iso(), shot_id])

    conn = get_connection()
    try:
        conn.execute(
            f"UPDATE shots SET {', '.join(set_clauses)} WHERE id = ?",
            params,
        )
        conn.commit()
    finally:
        conn.close()


def update_shot_duration(shot_id: int, duration_seconds: int) -> None:
    duration_seconds = max(1, min(30, int(duration_seconds)))
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE shots SET duration_seconds = ?, updated_at = ? WHERE id = ?",
            (duration_seconds, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def create_quick_video_project(prompt: str, aspect_ratio: str) -> int:
    return create_project(ProjectInput(
        title="__quick_video__",
        story_prompt=prompt[:200],
        style="cinematic",
        aspect_ratio=aspect_ratio,
        target_duration=5,
    ))


def update_task_output(task_id: int, output_url: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE tasks SET output_url = ?, updated_at = ? WHERE id = ?",
            (output_url, now_iso(), task_id),
        )
        conn.commit()
    finally:
        conn.close()


def list_quick_video_tasks(limit: int = 20) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT t.*, p.story_prompt, p.aspect_ratio, p.target_duration
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.task_type = 'generate_quick_video'
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            import json as _json
            try:
                d["params"] = _json.loads(d.get("params", "{}"))
            except Exception:
                d["params"] = {}
            result.append(d)
        return result
    finally:
        conn.close()


def list_kling_tasks(limit: int = 20) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT t.*, p.story_prompt, p.aspect_ratio, p.target_duration
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.task_type = 'kling' OR t.task_type LIKE 'kling_%'
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            import json as _json
            try:
                d["params"] = _json.loads(d.get("params", "{}"))
            except Exception:
                d["params"] = {}
            result.append(d)
        return result
    finally:
        conn.close()


def list_seedance_tasks(limit: int = 20) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT t.*, p.story_prompt, p.aspect_ratio, p.target_duration
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.task_type = 'seedance' OR t.task_type LIKE 'seedance_%'
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            import json as _json
            try:
                d["params"] = _json.loads(d.get("params", "{}"))
            except Exception:
                d["params"] = {}
            result.append(d)
        return result
    finally:
        conn.close()


def list_projects() -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM projects WHERE deleted_at IS NULL AND title != '__quick_video__' ORDER BY updated_at DESC, id DESC"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def list_deleted_projects() -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_project(project_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_project_shots(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM shots WHERE project_id = ? ORDER BY order_index ASC, id ASC",
            (project_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_shot(shot_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM shots WHERE id = ?", (shot_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_project_tasks(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT * FROM tasks
            WHERE project_id = ?
            ORDER BY id DESC
            """,
            (project_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_task(task_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def has_running_task(shot_id: int, task_type: str) -> bool:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM tasks WHERE shot_id = ? AND task_type = ? AND status IN ('queued', 'running') LIMIT 1",
            (shot_id, task_type),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


# --- Shot operations ---

def create_shot(project_id: int, data: dict[str, Any]) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        cur = conn.execute(
            """
            INSERT INTO shots (
                project_id, order_index, shot_title, shot_description,
                shot_prompt, duration_seconds, status,
                character_action, scene_description, camera_movement,
                emotion_keywords, narration_text,
                start_frame_prompt, end_frame_prompt, video_prompt,
                character_ids, scene_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                data.get("order_index", 0),
                data.get("shot_title", ""),
                data.get("shot_description", ""),
                data.get("shot_prompt", ""),
                data.get("duration_seconds", 5),
                data.get("status", "planned"),
                data.get("character_action", ""),
                data.get("scene_description", ""),
                data.get("camera_movement", ""),
                data.get("emotion_keywords", ""),
                data.get("narration_text", ""),
                data.get("start_frame_prompt", ""),
                data.get("end_frame_prompt", ""),
                data.get("video_prompt", ""),
                data.get("character_ids", "[]"),
                data.get("scene_id"),
                ts, ts,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def delete_shot(shot_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM shots WHERE id = ?", (shot_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_shot_order(shot_id: int, order_index: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE shots SET order_index = ?, updated_at = ? WHERE id = ?",
            (order_index, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_shot_single_frame(shot_id: int, frame_type: str, frame_path: str) -> None:
    col = "start_frame_path" if frame_type == "start" else "end_frame_path"
    conn = get_connection()
    try:
        conn.execute(
            f"UPDATE shots SET {col} = ?, updated_at = ? WHERE id = ?",
            (frame_path, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_shot_status(shot_id: int, status: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE shots SET status = ?, updated_at = ? WHERE id = ?",
            (status, now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def clear_shot_outputs(shot_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE shots
               SET start_frame_path = NULL, end_frame_path = NULL, video_path = NULL,
                   status = 'prompt_updated', updated_at = ?
               WHERE id = ?""",
            (now_iso(), shot_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_project(project_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE projects SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now_iso(), project_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def restore_project(project_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE projects SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
            (project_id,),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def permanent_delete_project(project_id: int) -> bool:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM shots WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM characters WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM scenes WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM story_versions WHERE project_id = ?", (project_id,))
        cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


# --- Character CRUD ---

def _to_str(val):
    if isinstance(val, list):
        return ", ".join(str(v) for v in val)
    return str(val) if val is not None else ""


def create_character(project_id: int, data: dict[str, Any]) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        cur = conn.execute(
            """
            INSERT INTO characters (project_id, name, appearance_prompt, personality_tags, voice_profile, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                data.get("name", ""),
                data.get("appearance_prompt", ""),
                _to_str(data.get("personality_tags", "")),
                data.get("voice_profile", ""),
                ts, ts,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_character(char_id: int, data: dict[str, Any]) -> None:
    conn = get_connection()
    try:
        if "image_path" in data:
            conn.execute(
                """UPDATE characters
                   SET name = ?, appearance_prompt = ?, personality_tags = ?, voice_profile = ?, image_path = ?, updated_at = ?
                   WHERE id = ?""",
                (data["name"], data["appearance_prompt"], _to_str(data.get("personality_tags", "")), data["voice_profile"], data["image_path"], now_iso(), char_id),
            )
        else:
            conn.execute(
                """UPDATE characters
                   SET name = ?, appearance_prompt = ?, personality_tags = ?, voice_profile = ?, updated_at = ?
                   WHERE id = ?""",
                (data["name"], data["appearance_prompt"], _to_str(data.get("personality_tags", "")), data["voice_profile"], now_iso(), char_id),
            )
        conn.commit()
    finally:
        conn.close()


def delete_character(char_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM characters WHERE id = ?", (char_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_project_characters(project_id: int) -> int:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM characters WHERE project_id = ?", (project_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def delete_unlocked_characters(project_id: int) -> int:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM characters WHERE project_id = ? AND locked = 0", (project_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def list_project_characters(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM characters WHERE project_id = ? ORDER BY id ASC", (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_character(char_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM characters WHERE id = ?", (char_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def lock_character(char_id: int, locked: bool) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE characters SET locked = ?, updated_at = ? WHERE id = ?",
            (1 if locked else 0, now_iso(), char_id),
        )
        conn.commit()
    finally:
        conn.close()


# --- Scene CRUD ---

def create_scene(project_id: int, data: dict[str, Any]) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        cur = conn.execute(
            """
            INSERT INTO scenes (project_id, name, description, reference_image_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                data.get("name", ""),
                data.get("description", ""),
                data.get("reference_image_path"),
                ts, ts,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_scene(scene_id: int, data: dict[str, Any]) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE scenes
               SET name = ?, description = ?, reference_image_path = ?, updated_at = ?
               WHERE id = ?""",
            (data["name"], data["description"], data.get("reference_image_path"), now_iso(), scene_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_scene(scene_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM scenes WHERE id = ?", (scene_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_project_scenes(project_id: int) -> int:
    conn = get_connection()
    try:
        conn.execute("UPDATE shots SET scene_id = NULL WHERE project_id = ?", (project_id,))
        cur = conn.execute("DELETE FROM scenes WHERE project_id = ?", (project_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def list_project_scenes(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM scenes WHERE project_id = ? ORDER BY id ASC", (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_scene(scene_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# --- Story versions ---

def create_story_version(project_id: int, content: str) -> int:
    conn = get_connection()
    try:
        ts = now_iso()
        row = conn.execute(
            "SELECT COALESCE(MAX(version), 0) FROM story_versions WHERE project_id = ?",
            (project_id,),
        ).fetchone()
        next_version = (row[0] or 0) + 1
        cur = conn.execute(
            "INSERT INTO story_versions (project_id, content, version, created_at) VALUES (?, ?, ?, ?)",
            (project_id, content, next_version, ts),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def list_story_versions(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM story_versions WHERE project_id = ? ORDER BY version DESC", (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_story_version(version_id: int) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM story_versions WHERE id = ?", (version_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ---- Settings ----

def get_setting(key: str) -> str | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None
    finally:
        conn.close()


def get_all_settings() -> dict[str, str]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {row["key"]: row["value"] for row in rows}
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def set_settings(data: dict[str, str]) -> None:
    conn = get_connection()
    try:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            list(data.items()),
        )
        conn.commit()
    finally:
        conn.close()


def delete_setting(key: str) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        conn.commit()
    finally:
        conn.close()
