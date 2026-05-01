#!/usr/bin/env python3
"""One-shot entry point for the idea-to-feishu-script pipeline.

Combines bootstrap, prompt pack generation, deliverable detection,
validation, and optional publish into a single command.

Usage:
    # Bootstrap from idea + build prompts + validate
    python -m video_lab.scripts.run_one_shot --idea /path/to/idea.md --run-dir /path/to/runs

    # Just rebuild prompts for existing workspace
    python -m video_lab.scripts.run_one_shot --run-dir /path/to/runs/existing-run

    # Validate + publish
    python -m video_lab.scripts.run_one_shot --run-dir /path/to/runs/existing-run --publish
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add parent to path so we can import sibling modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from video_lab.scripts.build_prompt_pack import build_manifest, STAGES, FILE_MAP
from video_lab.scripts.bootstrap_run import bootstrap


def _load_run_json(run_dir: Path) -> dict:
    run_json = run_dir / "run.json"
    if not run_json.exists():
        return {}
    try:
        return json.loads(run_json.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_run_json(run_dir: Path, data: dict) -> None:
    run_json = run_dir / "run.json"
    run_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def detect_deliverables(run_dir: Path) -> dict[str, bool]:
    """Check which deliverables exist in the run workspace."""
    result = {}
    for key, (filename, _) in FILE_MAP.items():
        path = run_dir / filename
        if key == "brief":
            # brief.json is ready if it has more than just the placeholder
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    assumptions = data.get("assumptions", [])
                    result[key] = not (
                        len(assumptions) == 1
                        and "Fill this file" in str(assumptions[0])
                    )
                except Exception:
                    result[key] = False
            else:
                result[key] = False
        else:
            if path.exists():
                content = path.read_text(encoding="utf-8").strip()
                result[key] = bool(content) and "TODO" not in content[:100]
            else:
                result[key] = False
    return result


def validate_run(run_dir: Path) -> dict:
    """Validate the run workspace. Returns status dict."""
    deliverables = detect_deliverables(run_dir)
    manifest = build_manifest(run_dir, STAGES)

    # Check if all content stages are ready
    content_keys = ["brief", "story", "characters", "scenes", "script"]
    content_ready = all(deliverables.get(k, False) for k in content_keys)
    review_ready = deliverables.get("review", False)

    # Find next stage to run
    next_stage = None
    for stage_def in STAGES:
        stage_name = stage_def["stage"]
        output_key = stage_def["output_key"]
        if not deliverables.get(output_key, False):
            # Check if inputs are ready
            stage_info = next(
                (s for s in manifest["stages"] if s["stage"] == stage_name),
                None,
            )
            if stage_info and stage_info["ready_inputs"]:
                next_stage = stage_name
                break

    return {
        "deliverables": deliverables,
        "content_ready": content_ready,
        "review_ready": review_ready,
        "next_stage": next_stage,
        "manifest": manifest,
    }


def print_status(run_dir: Path, validation: dict) -> None:
    """Print a human-readable status summary."""
    deliverables = validation["deliverables"]

    print(f"\n{'='*60}")
    print(f"Run: {run_dir.name}")
    print(f"{'='*60}")

    print("\nDeliverables:")
    for key, (filename, _) in FILE_MAP.items():
        status = "done" if deliverables.get(key, False) else "missing"
        marker = "x" if status == "done" else " "
        print(f"  [{marker}] {filename:25s} {key}")

    print(f"\nContent ready: {'yes' if validation['content_ready'] else 'no'}")
    print(f"Review ready:  {'yes' if validation['review_ready'] else 'no'}")

    if validation["next_stage"]:
        print(f"\nNext stage: {validation['next_stage']}")
    elif validation["content_ready"]:
        print("\nAll content stages complete. Ready for validation/review.")
    else:
        # Find first missing stage with unready inputs
        for stage_def in STAGES:
            if not deliverables.get(stage_def["output_key"], False):
                print(f"\nBlocked: {stage_def['stage']} needs inputs first")
                break


def update_run_status(run_dir: Path, validation: dict) -> None:
    """Update run.json with current status."""
    run_data = _load_run_json(run_dir)
    run_data.setdefault("status", {})
    run_data["status"]["prompt_pack_built"] = True
    run_data["status"]["content_ready"] = validation["content_ready"]
    run_data["status"]["validation_ready"] = validation["review_ready"]
    run_data["status"]["deliverables"] = validation["deliverables"]
    _save_run_json(run_dir, run_data)


def main():
    parser = argparse.ArgumentParser(description="One-shot pipeline entry point")
    parser.add_argument("--idea", default=None, help="Path to idea.md (creates new run if provided)")
    parser.add_argument("--run-dir", required=True, help="Run workspace or parent directory")
    parser.add_argument("--publish", action="store_true", help="Attempt publish after validation")
    parser.add_argument("--json", action="store_true", help="Output status as JSON")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()

    # Step 1: Bootstrap if idea provided
    if args.idea:
        idea_path = Path(args.idea).resolve()
        if not run_dir.name or not (run_dir / "run.json").exists():
            # run-dir is parent, create subdirectory
            target = bootstrap(idea_path, run_dir)
        else:
            # run-dir is the run workspace itself
            if not (run_dir / "idea.md").exists():
                idea_text = idea_path.read_text(encoding="utf-8")
                (run_dir / "idea.md").write_text(idea_text, encoding="utf-8")
            target = run_dir
        run_dir = target
    else:
        if not (run_dir / "run.json").exists():
            print(f"Error: {run_dir} is not a valid run workspace (no run.json)", file=sys.stderr)
            sys.exit(1)

    # Step 2: Build prompt pack
    from video_lab.scripts.build_prompt_pack import main as build_main
    # Re-run build_prompt_pack inline
    prompt_dir = run_dir / "prompts"
    prompt_dir.mkdir(parents=True, exist_ok=True)

    from video_lab.scripts.build_prompt_pack import build_prompt, build_manifest
    for stage_def in STAGES:
        prompt_text = build_prompt(stage_def, run_dir)
        prompt_file = prompt_dir / stage_def["filename"]
        prompt_file.write_text(prompt_text, encoding="utf-8")

    manifest = build_manifest(run_dir, STAGES)
    (prompt_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Step 3: Detect deliverables
    validation = detect_deliverables(run_dir)
    validation_result = {
        "deliverables": validation,
        "content_ready": all(validation.get(k, False) for k in ["brief", "story", "characters", "scenes", "script"]),
        "review_ready": validation.get("review", False),
        "next_stage": None,
        "manifest": manifest,
    }

    # Find next stage
    for stage_def in STAGES:
        if not validation.get(stage_def["output_key"], False):
            stage_info = next(
                (s for s in manifest["stages"] if s["stage"] == stage_def["stage"]),
                None,
            )
            if stage_info and stage_info["ready_inputs"]:
                validation_result["next_stage"] = stage_def["stage"]
                break

    # Step 4: Update run.json
    update_run_status(run_dir, validation_result)

    # Step 5: Output
    if args.json:
        print(json.dumps(validation_result, ensure_ascii=False, indent=2))
    else:
        print_status(run_dir, validation_result)

    # Step 6: Publish if requested
    if args.publish:
        if validation_result["review_ready"]:
            print("\nValidation passed. Publishing...")
            # TODO: integrate with feishu-doc skill for publish
            print("Publish not yet implemented. Use feishu-doc skill manually.")
        else:
            print("\nCannot publish: review not ready.")
            sys.exit(1)


if __name__ == "__main__":
    main()
