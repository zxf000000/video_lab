import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
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
                FOREIGN KEY(project_id) REFERENCES projects(id)
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
            """
        )
        _migrate_schema(conn)
        conn.commit()
    finally:
        conn.close()


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Add new columns to existing tables if they don't exist."""
    existing_shots = {row[1] for row in conn.execute("PRAGMA table_info(shots)").fetchall()}
    for col, col_def in [
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

    existing_chars = {row[1] for row in conn.execute("PRAGMA table_info(characters)").fetchall()}
    if "image_path" not in existing_chars:
        conn.execute("ALTER TABLE characters ADD COLUMN image_path TEXT DEFAULT ''")

    existing_projects = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    if "deleted_at" not in existing_projects:
        conn.execute("ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT NULL")
