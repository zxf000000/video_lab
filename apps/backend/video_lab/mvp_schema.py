from __future__ import annotations

import sqlite3


GREENFIELD_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    genre TEXT NOT NULL DEFAULT '',
    target_platform TEXT NOT NULL DEFAULT '',
    episode_count_planned INTEGER NOT NULL DEFAULT 30,
    current_stage TEXT NOT NULL DEFAULT 'draft',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    logline TEXT NOT NULL DEFAULT '',
    target_audience TEXT NOT NULL DEFAULT '',
    genre_tags TEXT NOT NULL DEFAULT '[]',
    style_keywords TEXT NOT NULL DEFAULT '[]',
    world_rules TEXT NOT NULL DEFAULT '',
    main_conflict TEXT NOT NULL DEFAULT '',
    relationship_summary TEXT NOT NULL DEFAULT '',
    reversal_rules TEXT NOT NULL DEFAULT '',
    forbidden_rules TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role_type TEXT NOT NULL DEFAULT '',
    identity_summary TEXT NOT NULL DEFAULT '',
    appearance_summary TEXT NOT NULL DEFAULT '',
    personality_tags TEXT NOT NULL DEFAULT '[]',
    speech_style TEXT NOT NULL DEFAULT '',
    visual_profile TEXT NOT NULL DEFAULT '{}',
    image_prompt TEXT NOT NULL DEFAULT '',
    negative_prompt TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL DEFAULT '',
    voice_profile TEXT NOT NULL DEFAULT '{}',
    outfit_presets TEXT NOT NULL DEFAULT '[]',
    negative_constraints TEXT NOT NULL DEFAULT '',
    reference_asset_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    image_status TEXT NOT NULL DEFAULT '',
    version_no INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    scene_type TEXT NOT NULL DEFAULT '',
    space_description TEXT NOT NULL DEFAULT '',
    lighting_style TEXT NOT NULL DEFAULT '',
    time_of_day TEXT NOT NULL DEFAULT '',
    weather TEXT NOT NULL DEFAULT '',
    prop_list TEXT NOT NULL DEFAULT '[]',
    negative_constraints TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    negative_prompt TEXT NOT NULL DEFAULT '',
    reference_asset_ids TEXT NOT NULL DEFAULT '[]',
    variants TEXT NOT NULL DEFAULT '[]',
    episode_id INTEGER DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    version_no INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS episode_scene_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id      INTEGER NOT NULL,
    scene_preset_id INTEGER NOT NULL,
    lighting_style  TEXT NOT NULL DEFAULT '',
    time_of_day     TEXT NOT NULL DEFAULT '',
    weather         TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY(scene_preset_id) REFERENCES scene_presets(id) ON DELETE CASCADE,
    UNIQUE(episode_id, scene_preset_id)
);

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    episode_no INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    core_conflict TEXT NOT NULL DEFAULT '',
    opening_hook TEXT NOT NULL DEFAULT '',
    climax TEXT NOT NULL DEFAULT '',
    ending_hook TEXT NOT NULL DEFAULT '',
    screenplay_content TEXT NOT NULL DEFAULT '',
    screenplay_content_en TEXT NOT NULL DEFAULT '',
    screenplay_scenes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    scene_block TEXT NOT NULL DEFAULT '',
    shot_no INTEGER NOT NULL,
    visual_goal TEXT NOT NULL DEFAULT '',
    character_ids TEXT NOT NULL DEFAULT '[]',
    scene_preset_id INTEGER,
    shot_size TEXT NOT NULL DEFAULT '',
    camera_angle TEXT NOT NULL DEFAULT '',
    composition TEXT NOT NULL DEFAULT '',
    action_description TEXT NOT NULL DEFAULT '',
    facial_emotion TEXT NOT NULL DEFAULT '',
    camera_motion TEXT NOT NULL DEFAULT '',
    dialogue_excerpt TEXT NOT NULL DEFAULT '',
    estimated_duration_ms INTEGER NOT NULL DEFAULT 0,
    storyboard_url TEXT NOT NULL DEFAULT '',
    storyboard_prompt TEXT NOT NULL DEFAULT '',
    storyboard_video_prompt TEXT NOT NULL DEFAULT '',
    storyboard_first_frame_prompt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY(scene_preset_id) REFERENCES scene_presets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shot_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    prompt_text TEXT NOT NULL DEFAULT '',
    first_frame_prompt TEXT NOT NULL DEFAULT '',
    first_frame_negative_prompt TEXT NOT NULL DEFAULT '',
    video_prompt TEXT NOT NULL DEFAULT '',
    video_negative_prompt TEXT NOT NULL DEFAULT '',
    negative_prompt TEXT NOT NULL DEFAULT '',
    model_params TEXT NOT NULL DEFAULT '{}',
    reference_asset_ids TEXT NOT NULL DEFAULT '[]',
    first_frame_url TEXT NOT NULL DEFAULT '',
    first_frame_status TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    video_status TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generation_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    episode_id INTEGER,
    shot_id INTEGER,
    shot_prompt_id INTEGER,
    provider TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    input_payload TEXT NOT NULL DEFAULT '{}',
    output_assets TEXT NOT NULL DEFAULT '[]',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    cost_amount REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_prompt_id) REFERENCES shot_prompts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shot_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    task_id INTEGER,
    shot_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY(task_id) REFERENCES generation_tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS review_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    episode_id INTEGER,
    shot_id INTEGER,
    generation_task_id INTEGER,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL DEFAULT '',
    rework_target_type TEXT NOT NULL DEFAULT 'shot_prompt',
    resolution_status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE SET NULL,
    FOREIGN KEY(generation_task_id) REFERENCES generation_tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS episode_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    selected_task_ids TEXT NOT NULL DEFAULT '[]',
    timeline_data TEXT NOT NULL DEFAULT '{}',
    subtitle_data TEXT NOT NULL DEFAULT '{}',
    audio_data TEXT NOT NULL DEFAULT '{}',
    preview_url TEXT NOT NULL DEFAULT '',
    export_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);
"""


ADDITIVE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS project_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    logline TEXT NOT NULL DEFAULT '',
    target_audience TEXT NOT NULL DEFAULT '',
    genre_tags TEXT NOT NULL DEFAULT '[]',
    style_keywords TEXT NOT NULL DEFAULT '[]',
    world_rules TEXT NOT NULL DEFAULT '',
    main_conflict TEXT NOT NULL DEFAULT '',
    relationship_summary TEXT NOT NULL DEFAULT '',
    reversal_rules TEXT NOT NULL DEFAULT '',
    forbidden_rules TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    scene_type TEXT NOT NULL DEFAULT '',
    space_description TEXT NOT NULL DEFAULT '',
    lighting_style TEXT NOT NULL DEFAULT '',
    time_of_day TEXT NOT NULL DEFAULT '',
    weather TEXT NOT NULL DEFAULT '',
    prop_list TEXT NOT NULL DEFAULT '[]',
    negative_constraints TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    negative_prompt TEXT NOT NULL DEFAULT '',
    reference_asset_ids TEXT NOT NULL DEFAULT '[]',
    variants TEXT NOT NULL DEFAULT '[]',
    episode_id INTEGER DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    version_no INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS episode_scene_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id      INTEGER NOT NULL,
    scene_preset_id INTEGER NOT NULL,
    lighting_style  TEXT NOT NULL DEFAULT '',
    time_of_day     TEXT NOT NULL DEFAULT '',
    weather         TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY(scene_preset_id) REFERENCES scene_presets(id) ON DELETE CASCADE,
    UNIQUE(episode_id, scene_preset_id)
);

CREATE TABLE IF NOT EXISTS shot_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    prompt_text TEXT NOT NULL DEFAULT '',
    first_frame_prompt TEXT NOT NULL DEFAULT '',
    first_frame_negative_prompt TEXT NOT NULL DEFAULT '',
    video_prompt TEXT NOT NULL DEFAULT '',
    video_negative_prompt TEXT NOT NULL DEFAULT '',
    negative_prompt TEXT NOT NULL DEFAULT '',
    model_params TEXT NOT NULL DEFAULT '{}',
    reference_asset_ids TEXT NOT NULL DEFAULT '[]',
    first_frame_url TEXT NOT NULL DEFAULT '',
    first_frame_status TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    video_status TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generation_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    episode_id INTEGER,
    shot_id INTEGER,
    shot_prompt_id INTEGER,
    provider TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    input_payload TEXT NOT NULL DEFAULT '{}',
    output_assets TEXT NOT NULL DEFAULT '[]',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    cost_amount REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_prompt_id) REFERENCES shot_prompts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shot_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    task_id INTEGER,
    shot_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY(task_id) REFERENCES generation_tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS review_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    episode_id INTEGER,
    shot_id INTEGER,
    generation_task_id INTEGER,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL DEFAULT '',
    rework_target_type TEXT NOT NULL DEFAULT 'shot_prompt',
    resolution_status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    FOREIGN KEY(shot_id) REFERENCES shots(id) ON DELETE SET NULL,
    FOREIGN KEY(generation_task_id) REFERENCES generation_tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS episode_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    selected_task_ids TEXT NOT NULL DEFAULT '[]',
    timeline_data TEXT NOT NULL DEFAULT '{}',
    subtitle_data TEXT NOT NULL DEFAULT '{}',
    audio_data TEXT NOT NULL DEFAULT '{}',
    preview_url TEXT NOT NULL DEFAULT '',
    export_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);
"""


def init_additive_schema(conn: sqlite3.Connection) -> None:
    """Create only the new MVP tables that do not collide with the legacy schema."""
    conn.executescript(ADDITIVE_SCHEMA_SQL)


def get_greenfield_schema_sql() -> str:
    """Return the full target schema for a fresh rebuild/migration."""
    return GREENFIELD_SCHEMA_SQL
