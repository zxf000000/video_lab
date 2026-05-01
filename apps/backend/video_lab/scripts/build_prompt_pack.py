#!/usr/bin/env python3
"""Build prompt pack for a run workspace.

Reads agent prompt templates, resolves input files from the run workspace,
and generates per-run prompts with correct paths and content injected.

Usage:
    python -m video_lab.scripts.build_prompt_pack --run-dir /path/to/run
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Agent stage definitions: order, name, template, input keys, output key
STAGES = [
    {
        "order": 1,
        "stage": "brief",
        "filename": "01_brief_agent.md",
        "role": "brief-agent",
        "description": "把用户原始创意整理成稳定的 brief.json",
        "input_keys": ["idea"],
        "output_key": "brief",
    },
    {
        "order": 2,
        "stage": "story",
        "filename": "02_story_agent.md",
        "role": "story-agent",
        "description": "把 brief 扩写为叙事层材料",
        "input_keys": ["brief"],
        "output_key": "story",
    },
    {
        "order": 3,
        "stage": "character",
        "filename": "03_character_agent.md",
        "role": "character-agent",
        "description": "生成角色卡、角色一致性规则和角色图提示词",
        "input_keys": ["brief", "story"],
        "output_key": "characters",
    },
    {
        "order": 4,
        "stage": "scene",
        "filename": "04_scene_agent.md",
        "role": "scene-agent",
        "description": "生成场景库、首帧提示词、场景提示词",
        "input_keys": ["brief", "story", "characters"],
        "output_key": "scenes",
    },
    {
        "order": 5,
        "stage": "script",
        "filename": "05_script_agent.md",
        "role": "script-agent",
        "description": "生成单集或整季剧本与镜头拆解",
        "input_keys": ["brief", "story", "characters", "scenes"],
        "output_key": "script",
    },
    {
        "order": 6,
        "stage": "reviewer",
        "filename": "06_reviewer_agent.md",
        "role": "reviewer",
        "description": "对已有交付物做语义评审，输出可执行的问题清单",
        "input_keys": ["brief", "story", "characters", "scenes", "script"],
        "output_key": "review",
    },
]

# File extensions for each key
FILE_MAP = {
    "idea": ("idea.md", "markdown"),
    "brief": ("brief.json", "json"),
    "story": ("story.md", "markdown"),
    "characters": ("characters.md", "markdown"),
    "scenes": ("scenes.md", "markdown"),
    "script": ("script.md", "markdown"),
    "review": ("review_report.md", "markdown"),
}


def _read_file(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def _format_input_block(key: str, file_path: Path, content: str) -> str:
    """Format an input material block for the prompt."""
    filename = FILE_MAP[key][0]
    fmt = FILE_MAP[key][1]

    if fmt == "json":
        code_block = f"```json\n{content}\n```" if content.strip() else '```json\n{\n  "project_name": "unknown",\n  "assumptions": ["input not yet generated"]\n}\n```'
    else:
        code_block = f"```markdown\n{content}\n```" if content.strip() else f"```markdown\n# TODO: generate {key}\n```"

    return f"""## 输入材料：{_key_label(key)}
- 文件：`{file_path}`

{code_block}"""


def _key_label(key: str) -> str:
    labels = {
        "idea": "用户原始创意",
        "brief": "brief.json",
        "story": "故事大纲",
        "characters": "角色连续性规则",
        "scenes": "场景库",
        "script": "剧本",
        "review": "评审报告",
    }
    return labels.get(key, key)


def _role_title(role: str) -> str:
    titles = {
        "brief-agent": "Brief Agent",
        "story-agent": "Story Agent",
        "character-agent": "Character Agent",
        "scene-agent": "Scene Agent",
        "script-agent": "Script Agent",
        "reviewer": "Reviewer",
    }
    return titles.get(role, role)


def _input_list(input_keys: list[str]) -> str:
    labels = {
        "idea": "`idea.md`",
        "brief": "`brief.json`",
        "story": "故事大纲",
        "characters": "角色卡",
        "scenes": "场景库",
    }
    parts = [labels.get(k, f"`{k}`") for k in input_keys]
    if len(parts) == 1:
        return parts[0]
    return "、".join(parts[:-1]) + "和" + parts[-1]


def build_prompt(stage_def: dict, run_dir: Path) -> str:
    """Build a single agent prompt for the given stage."""
    prompt_dir = run_dir / "prompts"
    output_file = run_dir / FILE_MAP[stage_def["output_key"]][0]

    # Build input blocks
    input_blocks = []
    for key in stage_def["input_keys"]:
        filename, _ = FILE_MAP[key]
        file_path = run_dir / filename
        content = _read_file(file_path)
        input_blocks.append(_format_input_block(key, file_path, content))

    inputs_text = "\n\n".join(input_blocks)

    return f"""# {_role_title(stage_def['role'])} Prompt

# {_role_title(stage_def['role'])} Prompt Template

你是 `{stage_def['role']}`。

{"输入：" + _input_list(stage_def['input_keys']) if stage_def['input_keys'] else ""}

任务：{stage_def['description']}。

{"输出要求见下方具体指令。" if stage_def['output_key'] != 'review' else "输出要求见下方具体指令。"}

## 执行要求
- 严格使用当前 run workspace 中的输入材料，不要凭空新增世界观。
- 输出文件路径：`{output_file}`
- 如果上游材料明显为空，先按保守假设生成，并把假设写入结果。

{inputs_text}"""


def build_manifest(run_dir: Path, stages: list[dict]) -> dict:
    """Build manifest.json content."""
    prompt_dir = run_dir / "prompts"
    stage_entries = []

    for stage_def in stages:
        output_key = stage_def["output_key"]
        filename, _ = FILE_MAP[output_key]
        output_path = run_dir / filename
        prompt_path = prompt_dir / stage_def["filename"]

        input_files = []
        for key in stage_def["input_keys"]:
            input_filename, _ = FILE_MAP[key]
            input_files.append(str(run_dir / input_filename))

        # Check readiness
        ready_inputs = all(Path(f).exists() for f in input_files)
        output_present = output_path.exists()

        stage_entries.append({
            "stage": stage_def["stage"],
            "prompt_file": str(prompt_path),
            "inputs": input_files,
            "output": str(output_path),
            "ready_inputs": ready_inputs,
            "output_present": output_present,
        })

    return {
        "run_dir": str(run_dir),
        "prompt_dir": str(prompt_dir),
        "stages": stage_entries,
    }


def main():
    parser = argparse.ArgumentParser(description="Build prompt pack for a run workspace")
    parser.add_argument("--run-dir", required=True, help="Path to the run workspace directory")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    if not run_dir.is_dir():
        print(f"Error: run directory does not exist: {run_dir}", file=sys.stderr)
        sys.exit(1)

    prompt_dir = run_dir / "prompts"
    prompt_dir.mkdir(parents=True, exist_ok=True)

    # Generate prompts
    for stage_def in STAGES:
        prompt_text = build_prompt(stage_def, run_dir)
        prompt_file = prompt_dir / stage_def["filename"]
        prompt_file.write_text(prompt_text, encoding="utf-8")
        print(f"  wrote {prompt_file.name}")

    # Generate manifest
    manifest = build_manifest(run_dir, STAGES)
    manifest_file = prompt_dir / "manifest.json"
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote manifest.json")

    # Update run.json status
    run_json_path = run_dir / "run.json"
    if run_json_path.exists():
        try:
            run_data = json.loads(run_json_path.read_text(encoding="utf-8"))
        except Exception:
            run_data = {}
    else:
        run_data = {}

    run_data.setdefault("project_name", run_dir.name)
    run_data["run_id"] = run_dir.name
    run_data["run_dir"] = str(run_dir)
    run_data.setdefault("status", {})
    run_data["status"]["prompt_pack_built"] = True
    run_data.setdefault("files", {})
    run_data["files"]["prompt_dir"] = str(prompt_dir)
    run_data["files"]["metadata"] = str(run_json_path)

    run_json_path.write_text(json.dumps(run_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  updated run.json")

    # Summary
    ready = sum(1 for s in manifest["stages"] if s["ready_inputs"])
    total = len(manifest["stages"])
    print(f"\nPrompt pack built: {ready}/{total} stages have inputs ready")


if __name__ == "__main__":
    main()
