import sqlite3
import os
from pathlib import Path

from .mvp_schema import init_additive_schema


BACKEND_DIR = Path(__file__).resolve().parent.parent
if BACKEND_DIR.name == "backend" and BACKEND_DIR.parent.name == "apps":
    REPO_ROOT = BACKEND_DIR.parent.parent
else:
    REPO_ROOT = BACKEND_DIR

DATA_DIR = Path(os.environ.get("VIDEO_LAB_DATA_DIR", REPO_ROOT / "data")).expanduser()
DB_PATH = DATA_DIR / "video_lab.sqlite3"
ASSETS_DIR = DATA_DIR / "assets"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                story_prompt TEXT NOT NULL,
                style TEXT NOT NULL,
                aspect_ratio TEXT NOT NULL,
                target_duration INTEGER NOT NULL,
                status TEXT NOT NULL,
                story_content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS shots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                episode_id INTEGER,
                order_index INTEGER NOT NULL,
                shot_title TEXT NOT NULL,
                shot_description TEXT NOT NULL,
                shot_prompt TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                status TEXT NOT NULL,
                start_frame_path TEXT,
                end_frame_path TEXT,
                video_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(episode_id) REFERENCES episodes(id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                shot_id INTEGER,
                task_type TEXT NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT NOT NULL DEFAULT '',
                output_url TEXT DEFAULT '',
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(shot_id) REFERENCES shots(id)
            );

            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                appearance_prompt TEXT NOT NULL DEFAULT '',
                personality_tags TEXT NOT NULL DEFAULT '',
                voice_profile TEXT NOT NULL DEFAULT '',
                locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS scenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                reference_image_path TEXT,
                locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS story_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS screenplay_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_en TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS beats_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_en TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                episode_number INTEGER NOT NULL DEFAULT 1,
                title TEXT NOT NULL DEFAULT '',
                outline_summary TEXT NOT NULL DEFAULT '',
                screenplay_content TEXT NOT NULL DEFAULT '',
                screenplay_content_en TEXT NOT NULL DEFAULT '',
                screenplay_scenes TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS episode_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                episode_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_en TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY(episode_id) REFERENCES episodes(id)
            );
            """
        )
        _migrate_schema(conn)
        init_additive_schema(conn)
        conn.commit()
    finally:
        conn.close()


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Add new columns to existing tables if they don't exist."""
    existing_shots = {row[1] for row in conn.execute("PRAGMA table_info(shots)").fetchall()}
    for col, col_def in [
        ("episode_id", "INTEGER REFERENCES episodes(id)"),
        ("character_action", "TEXT DEFAULT ''"),
        ("scene_description", "TEXT DEFAULT ''"),
        ("camera_movement", "TEXT DEFAULT ''"),
        ("emotion_keywords", "TEXT DEFAULT ''"),
        ("scene_id", "INTEGER REFERENCES scenes(id)"),
        ("narration_text", "TEXT DEFAULT ''"),
        ("start_frame_prompt", "TEXT DEFAULT ''"),
        ("end_frame_prompt", "TEXT DEFAULT ''"),
        ("video_prompt", "TEXT DEFAULT ''"),
        ("character_ids", "TEXT DEFAULT '[]'"),
    ]:
        if col not in existing_shots:
            conn.execute(f"ALTER TABLE shots ADD COLUMN {col} {col_def}")

    existing_tasks = {row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()}
    if "output_url" not in existing_tasks:
        conn.execute("ALTER TABLE tasks ADD COLUMN output_url TEXT DEFAULT ''")
    if "retry_count" not in existing_tasks:
        conn.execute("ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0")
    if "params" not in existing_tasks:
        conn.execute("ALTER TABLE tasks ADD COLUMN params TEXT DEFAULT '{}'")
    if "parent_task_id" not in existing_tasks:
        conn.execute("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER")

    existing_chars = {row[1] for row in conn.execute("PRAGMA table_info(characters)").fetchall()}
    if "image_path" not in existing_chars:
        conn.execute("ALTER TABLE characters ADD COLUMN image_path TEXT DEFAULT ''")
    for col, col_def in [
        ("role_type", "TEXT NOT NULL DEFAULT ''"),
        ("identity_summary", "TEXT NOT NULL DEFAULT ''"),
        ("appearance_summary", "TEXT NOT NULL DEFAULT ''"),
        ("speech_style", "TEXT NOT NULL DEFAULT ''"),
        ("visual_profile", "TEXT NOT NULL DEFAULT '{}'"),
        ("image_prompt", "TEXT NOT NULL DEFAULT ''"),
        ("negative_prompt", "TEXT NOT NULL DEFAULT ''"),
        ("outfit_presets", "TEXT NOT NULL DEFAULT '[]'"),
        ("negative_constraints", "TEXT NOT NULL DEFAULT ''"),
        ("reference_asset_ids", "TEXT NOT NULL DEFAULT '[]'"),
        ("status", "TEXT NOT NULL DEFAULT 'draft'"),
        ("image_status", "TEXT NOT NULL DEFAULT ''"),
        ("version_no", "INTEGER NOT NULL DEFAULT 1"),
    ]:
        if col not in existing_chars:
            conn.execute(f"ALTER TABLE characters ADD COLUMN {col} {col_def}")

    for col, col_def in [
        ("prompt_status", "TEXT NOT NULL DEFAULT ''"),
        ("anchor_status", "TEXT NOT NULL DEFAULT ''"),
        ("regenerate_status", "TEXT NOT NULL DEFAULT ''"),
    ]:
        if col not in existing_chars:
            conn.execute(f"ALTER TABLE characters ADD COLUMN {col} {col_def}")

    existing_projects = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    if "deleted_at" not in existing_projects:
        conn.execute("ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT NULL")
    for col, col_def in [
        ("screenplay_content", "TEXT NOT NULL DEFAULT ''"),
        ("screenplay_content_en", "TEXT NOT NULL DEFAULT ''"),
        ("beats_content", "TEXT NOT NULL DEFAULT ''"),
        ("beats_content_en", "TEXT NOT NULL DEFAULT ''"),
        ("name", "TEXT NOT NULL DEFAULT ''"),
        ("genre", "TEXT NOT NULL DEFAULT ''"),
        ("target_platform", "TEXT NOT NULL DEFAULT ''"),
        ("episode_count_planned", "INTEGER NOT NULL DEFAULT 30"),
        ("current_stage", "TEXT NOT NULL DEFAULT 'draft'"),
    ]:
        if col not in existing_projects:
            conn.execute(f"ALTER TABLE projects ADD COLUMN {col} {col_def}")
    conn.execute("UPDATE projects SET name = title WHERE name = ''")
    conn.execute("UPDATE projects SET current_stage = status WHERE current_stage = 'draft' AND status <> ''")

    existing_episodes = {row[1] for row in conn.execute("PRAGMA table_info(episodes)").fetchall()}
    if existing_episodes:
        for col, col_def in [
            ("screenplay_content", "TEXT NOT NULL DEFAULT ''"),
            ("screenplay_content_en", "TEXT NOT NULL DEFAULT ''"),
            ("screenplay_scenes", "TEXT NOT NULL DEFAULT '[]'"),
            ("status", "TEXT NOT NULL DEFAULT 'draft'"),
            ("episode_no", "INTEGER NOT NULL DEFAULT 1"),
            ("summary", "TEXT NOT NULL DEFAULT ''"),
            ("goal", "TEXT NOT NULL DEFAULT ''"),
            ("core_conflict", "TEXT NOT NULL DEFAULT ''"),
            ("opening_hook", "TEXT NOT NULL DEFAULT ''"),
            ("climax", "TEXT NOT NULL DEFAULT ''"),
            ("ending_hook", "TEXT NOT NULL DEFAULT ''"),
            ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
        ]:
            if col not in existing_episodes:
                conn.execute(f"ALTER TABLE episodes ADD COLUMN {col} {col_def}")
        conn.execute("UPDATE episodes SET episode_no = episode_number WHERE episode_no = 1 AND episode_number IS NOT NULL")
        conn.execute("UPDATE episodes SET summary = outline_summary WHERE summary = ''")
        conn.execute("UPDATE episodes SET sort_order = episode_number WHERE sort_order = 0 AND episode_number IS NOT NULL")

    existing_scenes = {row[1] for row in conn.execute("PRAGMA table_info(scenes)").fetchall()}
    if existing_scenes:
        for col, col_def in [
            ("scene_type", "TEXT NOT NULL DEFAULT ''"),
            ("space_description", "TEXT NOT NULL DEFAULT ''"),
            ("lighting_style", "TEXT NOT NULL DEFAULT ''"),
            ("time_of_day", "TEXT NOT NULL DEFAULT ''"),
            ("weather", "TEXT NOT NULL DEFAULT ''"),
            ("prop_list", "TEXT NOT NULL DEFAULT '[]'"),
            ("reference_asset_ids", "TEXT NOT NULL DEFAULT '[]'"),
            ("variants", "TEXT NOT NULL DEFAULT '[]'"),
            ("status", "TEXT NOT NULL DEFAULT 'draft'"),
            ("version_no", "INTEGER NOT NULL DEFAULT 1"),
        ]:
            if col not in existing_scenes:
                conn.execute(f"ALTER TABLE scenes ADD COLUMN {col} {col_def}")
        conn.execute("UPDATE scenes SET space_description = description WHERE space_description = ''")

    existing_shots = {row[1] for row in conn.execute("PRAGMA table_info(shots)").fetchall()}
    for col, col_def in [
        ("scene_block", "TEXT NOT NULL DEFAULT ''"),
        ("shot_no", "INTEGER NOT NULL DEFAULT 1"),
        ("visual_goal", "TEXT NOT NULL DEFAULT ''"),
        ("scene_preset_id", "INTEGER"),
        ("shot_size", "TEXT NOT NULL DEFAULT ''"),
        ("camera_angle", "TEXT NOT NULL DEFAULT ''"),
        ("camera_motion", "TEXT NOT NULL DEFAULT ''"),
        ("composition", "TEXT NOT NULL DEFAULT ''"),
        ("action_description", "TEXT NOT NULL DEFAULT ''"),
        ("facial_emotion", "TEXT NOT NULL DEFAULT ''"),
        ("dialogue_excerpt", "TEXT NOT NULL DEFAULT ''"),
        ("estimated_duration_ms", "INTEGER NOT NULL DEFAULT 0"),
        ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
        ("batch_id", "INTEGER REFERENCES shot_batches(id) ON DELETE SET NULL"),
    ]:
        if col not in existing_shots:
            conn.execute(f"ALTER TABLE shots ADD COLUMN {col} {col_def}")
    conn.execute("UPDATE shots SET shot_no = order_index WHERE shot_no = 1 AND order_index IS NOT NULL")
    conn.execute("UPDATE shots SET sort_order = order_index WHERE sort_order = 0 AND order_index IS NOT NULL")
    conn.execute("UPDATE shots SET visual_goal = shot_description WHERE visual_goal = ''")
    conn.execute("UPDATE shots SET action_description = character_action WHERE action_description = ''")
    conn.execute("UPDATE shots SET camera_angle = camera_movement WHERE camera_angle = ''")
    conn.execute("UPDATE shots SET estimated_duration_ms = duration_seconds * 1000 WHERE estimated_duration_ms = 0 AND duration_seconds IS NOT NULL")

    existing_scene_presets = {row[1] for row in conn.execute("PRAGMA table_info(scene_presets)").fetchall()}
    if existing_scene_presets and "episode_id" not in existing_scene_presets:
        conn.execute("ALTER TABLE scene_presets ADD COLUMN episode_id INTEGER DEFAULT NULL")

    existing_shot_prompts = {row[1] for row in conn.execute("PRAGMA table_info(shot_prompts)").fetchall()}
    if existing_shot_prompts:
        for col, col_def in [
            ("first_frame_prompt", "TEXT NOT NULL DEFAULT ''"),
            ("first_frame_negative_prompt", "TEXT NOT NULL DEFAULT ''"),
            ("video_prompt", "TEXT NOT NULL DEFAULT ''"),
            ("video_negative_prompt", "TEXT NOT NULL DEFAULT ''"),
            ("first_frame_url", "TEXT NOT NULL DEFAULT ''"),
            ("video_url", "TEXT NOT NULL DEFAULT ''"),
            ("first_frame_status", "TEXT NOT NULL DEFAULT ''"),
            ("video_status", "TEXT NOT NULL DEFAULT ''"),
        ]:
            if col not in existing_shot_prompts:
                conn.execute(f"ALTER TABLE shot_prompts ADD COLUMN {col} {col_def}")
