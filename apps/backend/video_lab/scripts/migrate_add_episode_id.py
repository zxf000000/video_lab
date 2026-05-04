#!/usr/bin/env python3
"""
Migration: Add episode_id column to scene_presets table.
Run this to fix existing databases that don't have episode_id support.
"""

import sqlite3
from pathlib import Path

def migrate():
    # Find the database
    BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
    if BACKEND_DIR.name == "backend" and BACKEND_DIR.parent.name == "apps":
        REPO_ROOT = BACKEND_DIR.parent.parent
    else:
        REPO_ROOT = BACKEND_DIR

    DATA_DIR = REPO_ROOT / "data"
    DB_PATH = DATA_DIR / "video_lab.sqlite3"

    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if episode_id column already exists
        cursor.execute("PRAGMA table_info(scene_presets)")
        columns = [row[1] for row in cursor.fetchall()]

        if "episode_id" in columns:
            print("✓ episode_id column already exists")
            return True

        print("Adding episode_id column to scene_presets...")
        cursor.execute("""
            ALTER TABLE scene_presets
            ADD COLUMN episode_id INTEGER
            REFERENCES episodes(id) ON DELETE SET NULL
        """)

        conn.commit()
        print("✓ Migration complete")
        return True

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
