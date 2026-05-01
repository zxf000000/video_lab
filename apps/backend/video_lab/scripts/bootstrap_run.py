#!/usr/bin/env python3
"""Bootstrap a run workspace from an idea file.

Creates the directory structure, copies idea.md, initializes run.json
with status fields, and creates the prompts/ directory.

Usage:
    python -m video_lab.scripts.bootstrap_run --idea /path/to/idea.md --run-dir /path/to/run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def _slugify(text: str) -> str:
    """Convert text to a filesystem-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:60].strip("-") or "run"


def _extract_project_name(idea_text: str) -> str:
    """Try to extract a project name from the idea text."""
    for line in idea_text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line.startswith("暂定片名") or line.startswith("片名"):
            match = re.search(r"[：:]\s*(.+)", line)
            if match:
                return match.group(1).strip().strip("《》")
    return ""


def bootstrap(idea_path: Path, run_dir: Path, run_id: str | None = None) -> Path:
    """Create a run workspace from an idea file.

    Returns the run directory path.
    """
    if not idea_path.exists():
        raise FileNotFoundError(f"Idea file not found: {idea_path}")

    idea_text = idea_path.read_text(encoding="utf-8")
    project_name = _extract_project_name(idea_text)

    if not run_id:
        run_id = _slugify(project_name or idea_path.stem)

    target = run_dir / run_id
    target.mkdir(parents=True, exist_ok=True)

    # Copy idea.md
    idea_target = target / "idea.md"
    if not idea_target.exists():
        idea_target.write_text(idea_text, encoding="utf-8")

    # Create prompts directory
    (target / "prompts").mkdir(exist_ok=True)

    # Initialize run.json
    run_json = target / "run.json"
    run_data = {
        "project_name": project_name or run_id,
        "run_id": run_id,
        "run_dir": str(target),
        "status": {
            "bootstrap_ok": True,
            "prompt_pack_built": False,
            "content_ready": False,
            "validation_ready": False,
        },
        "files": {
            "idea": str(idea_target),
            "brief": str(target / "brief.json"),
            "story": str(target / "story.md"),
            "characters": str(target / "characters.md"),
            "scenes": str(target / "scenes.md"),
            "script": str(target / "script.md"),
            "review": str(target / "review_report.md"),
            "prompt_dir": str(target / "prompts"),
            "metadata": str(run_json),
        },
    }
    run_json.write_text(json.dumps(run_data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Create README
    readme = target / "README.md"
    readme.write_text(f"""# Run Workspace: {project_name or run_id}

- run_id: `{run_id}`
- idea: `{idea_target}`
- brief: `{target / "brief.json"}`
- story: `{target / "story.md"}`
- characters: `{target / "characters.md"}`
- scenes: `{target / "scenes.md"}`
- script: `{target / "script.md"}`
- review: `{target / "review_report.md"}`
- prompts: `{target / "prompts"}`

One-shot order:
1. Run build_prompt_pack.py with --run-dir.
2. Use prompts/*.md to generate brief/story/characters/scenes/script/review.
3. Run orchestrate_pipeline.py with --run-dir.
4. Or use run_one_shot.py to bootstrap + build prompts + validate/publish in one command.
""", encoding="utf-8")

    return target


def main():
    parser = argparse.ArgumentParser(description="Bootstrap a run workspace from an idea file")
    parser.add_argument("--idea", required=True, help="Path to idea.md")
    parser.add_argument("--run-dir", required=True, help="Parent directory for run workspaces")
    parser.add_argument("--run-id", default=None, help="Custom run ID (auto-generated if omitted)")
    args = parser.parse_args()

    idea_path = Path(args.idea).resolve()
    run_dir = Path(args.run_dir).resolve()

    target = bootstrap(idea_path, run_dir, args.run_id)
    print(f"Run workspace created: {target}")
    print(f"  run.json: {target / 'run.json'}")
    print(f"  prompts/: {target / 'prompts'}")


if __name__ == "__main__":
    main()
