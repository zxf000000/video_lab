#!/usr/bin/env python3
"""
角色生成结果验证器
评估 character proposal 的质量，输出评分和改进建议。

用法:
  python3 validate_character.py <proposal.json> [--brief <brief.json>] [--existing <characters.json>] [--llm]

proposal.json 格式:
  { "roles": [ { "character_profile": {...}, "image_spec": {...} } ] }

brief.json 格式:
  { "world_rules": "...", "main_conflict": "...", "relationship_summary": "...", "reversal_rules": "...", "forbidden_rules": "...", "genre_tags": [...], "style_keywords": [...] }

characters.json 格式:
  [ { "character_profile": { "name": "...", "role_type": "...", ... } } ]

--llm: 启用 LLM 语义评判（需要网络，调用项目配置的 API）
"""

import json
import sys
import os
import re
import urllib.request
from dataclasses import dataclass, field
from typing import Optional


# ── 字段定义 ──────────────────────────────────────────────

REQUIRED_PROFILE_FIELDS = [
    "name", "role_type", "species", "identity_summary", "appearance_summary",
    "personality_tags", "speech_style", "negative_constraints",
]

REQUIRED_IMAGE_SPEC_FIELDS = [
    "gender_presentation", "age_range", "body_type", "face_features",
    "hair_style", "hair_color", "eye_style", "signature_expression",
    "signature_pose", "clothing_style", "color_palette", "visual_keywords",
    "negative_visual_constraints", "image_prompt", "negative_prompt",
]

LIST_FIELDS = ["personality_tags", "color_palette", "visual_keywords", "negative_visual_constraints"]

ROLE_TYPES = {"主角", "反派", "配角", "盟友", "导师", "对手", "关键配角", "路人"}


# ── 评分结果 ──────────────────────────────────────────────

@dataclass
class FieldCheck:
    field: str
    score: int  # 0-10
    note: str

@dataclass
class CategoryScore:
    name: str
    score: int  # 0-100
    checks: list = field(default_factory=list)

@dataclass
class ValidationResult:
    total_score: int
    grade: str
    categories: list = field(default_factory=list)
    summary: str = ""


# ── 验证逻辑 ──────────────────────────────────────────────

def check_field_present(data: dict, field: str, label: str = "") -> FieldCheck:
    val = data.get(field, "")
    if isinstance(val, str) and val.strip():
        return FieldCheck(field=label or field, score=10, note="已填写")
    if isinstance(val, list) and len(val) > 0:
        return FieldCheck(field=label or field, score=10, note=f"已填写 ({len(val)} 项)")
    return FieldCheck(field=label or field, score=0, note="未填写或为空")


def check_field_quality(data: dict, field: str, min_len: int = 5, label: str = "") -> FieldCheck:
    val = data.get(field, "")
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return FieldCheck(field=label or field, score=0, note="空")
        if len(val) < min_len:
            return FieldCheck(field=label or field, score=4, note=f"过短 ({len(val)} 字符, 建议 ≥{min_len})")
        if len(val) < min_len * 2:
            return FieldCheck(field=label or field, score=7, note=f"一般 ({len(val)} 字符)")
        return FieldCheck(field=label or field, score=10, note=f"充足 ({len(val)} 字符)")
    if isinstance(val, list):
        if len(val) == 0:
            return FieldCheck(field=label or field, score=0, note="空数组")
        if len(val) == 1:
            return FieldCheck(field=label or field, score=5, note="仅 1 项, 建议更多")
        return FieldCheck(field=label or field, score=10, note=f"{len(val)} 项")
    return FieldCheck(field=label or field, score=0, note="类型错误")


def check_role_type(data: dict) -> FieldCheck:
    rt = data.get("role_type", "").strip()
    if not rt:
        return FieldCheck(field="role_type", score=0, note="未填写")
    if rt in ROLE_TYPES:
        return FieldCheck(field="role_type", score=10, note=f"标准类型: {rt}")
    # 模糊匹配
    for known in ROLE_TYPES:
        if known in rt or rt in known:
            return FieldCheck(field="role_type", score=8, note=f"接近标准: {rt}")
    return FieldCheck(field="role_type", score=5, note=f"非标准类型: {rt}, 建议使用: {', '.join(ROLE_TYPES)}")


def check_image_prompt_quality(image_spec: dict) -> FieldCheck:
    prompt = image_spec.get("image_prompt", "").strip()
    if not prompt:
        return FieldCheck(field="image_prompt", score=0, note="空 — 无法出图")
    score = 0
    notes = []
    # 长度
    if len(prompt) < 30:
        notes.append("过短")
        score += 2
    elif len(prompt) < 80:
        notes.append("偏短")
        score += 5
    else:
        score += 7
    # 包含风格关键词
    style_hints = ["photo", "realistic", "cinematic", "lighting", "camera",
                   "portrait", "full-body", "写实", "摄影", "电影", "镜头", "光影"]
    if any(hint.lower() in prompt.lower() for hint in style_hints):
        score += 2
        notes.append("有风格描述")
    # 包含负面约束
    negative = image_spec.get("negative_prompt", "").strip()
    if negative:
        score += 1
        notes.append("有 negative_prompt")
    return FieldCheck(field="image_prompt", score=min(score, 10), note="; ".join(notes) if notes else "基本可用")


def _extract_chinese_bigrams(text: str) -> set:
    """提取中文二元组用于模糊匹配"""
    text = text.lower()
    # 提取连续中文片段
    segments = re.findall(r'[\u4e00-\u9fff]+', text)
    bigrams = set()
    for seg in segments:
        # 生成 2-4 字的子串
        for length in (2, 3, 4):
            for start in range(len(seg) - length + 1):
                bigrams.add(seg[start:start + length])
    return bigrams


def _bigram_overlap_score(text_a: str, text_b: str) -> tuple:
    """计算两段中文文本的二元组重叠度，返回 (score, matched_samples)"""
    bigrams_a = _extract_chinese_bigrams(text_a)
    bigrams_b = _extract_chinese_bigrams(text_b)
    if not bigrams_a or not bigrams_b:
        return 0, []
    overlap = bigrams_a & bigrams_b
    # 按长度排序，优先展示长匹配
    matched = sorted(overlap, key=lambda x: -len(x))
    # 评分: 重叠比例
    ratio = len(overlap) / max(len(bigrams_a), 1)
    if ratio >= 0.3:
        score = 10
    elif ratio >= 0.2:
        score = 8
    elif ratio >= 0.1:
        score = 6
    elif ratio >= 0.05:
        score = 4
    elif ratio > 0:
        score = 2
    else:
        score = 0
    return score, matched[:5]


def check_brief_compliance(profile: dict, brief: dict) -> FieldCheck:
    """检查角色是否与 brief 有关联（使用中文二元组模糊匹配）"""
    if not brief:
        return FieldCheck(field="brief_compliance", score=5, note="未提供 brief, 跳过检查")

    identity = profile.get("identity_summary", "")
    appearance = profile.get("appearance_summary", "")
    tags = " ".join(profile.get("personality_tags", []))
    char_text = f"{identity} {appearance} {tags}"

    scores = []
    notes = []

    # 主冲突关联 (权重 30)
    main_conflict = brief.get("main_conflict", "")
    if main_conflict:
        s, matched = _bigram_overlap_score(char_text, main_conflict)
        scores.append(s * 3)
        if matched:
            samples = ", ".join(m for m in matched[:3] if len(m) >= 2)
            notes.append(f"冲突关联({s}/10): {samples}")
        else:
            notes.append("冲突关联(0/10): 无匹配")

    # 世界观关联 (权重 25)
    world_rules = brief.get("world_rules", "")
    if world_rules:
        s, matched = _bigram_overlap_score(char_text, world_rules)
        scores.append(s * 2.5)
        if matched:
            samples = ", ".join(m for m in matched[:3] if len(m) >= 2)
            notes.append(f"世界观关联({s}/10): {samples}")
        else:
            notes.append("世界观关联(0/10): 无匹配")

    # 题材关联 (权重 20)
    genre_tags = brief.get("genre_tags", [])
    if genre_tags:
        genre_text = " ".join(genre_tags) if isinstance(genre_tags, list) else str(genre_tags)
        s, matched = _bigram_overlap_score(char_text, genre_text)
        scores.append(s * 2)
        if matched:
            samples = ", ".join(m for m in matched[:3] if len(m) >= 2)
            notes.append(f"题材关联({s}/10): {samples}")
        else:
            notes.append("题材关联(0/10): 无匹配")

    # 人物关系关联 (权重 15)
    relationship = brief.get("relationship_summary", "")
    if relationship:
        s, matched = _bigram_overlap_score(char_text, relationship)
        scores.append(s * 1.5)
        if matched:
            samples = ", ".join(m for m in matched[:3] if len(m) >= 2)
            notes.append(f"关系关联({s}/10): {samples}")
        else:
            notes.append("关系关联(0/10): 无匹配")

    # forbidden_rules 违反检查（排除角色类型词等常见名词，只检查行为层面的违反）
    forbidden = brief.get("forbidden_rules", "")
    if forbidden:
        s, violated = _bigram_overlap_score(char_text, forbidden)
        # 排除角色类型、常见名词等误报
        IGNORE_WORDS = {"主角", "反派", "配角", "盟友", "仇人", "兄弟", "兄弟为", "主角长", "角色"}
        real_violations = [v for v in violated if len(v) >= 2 and v not in IGNORE_WORDS]
        if real_violations:
            scores.append(-20)
            notes.append(f"⚠️ 疑似违反禁止规则: {', '.join(real_violations[:3])}")

    total = max(0, min(100, int(sum(scores)))) if scores else 0
    return FieldCheck(field="brief_compliance", score=total, note=" | ".join(notes) if notes else "无 brief 数据")


def check_uniqueness(profile: dict, existing: list) -> FieldCheck:
    """检查与已有角色的重复度"""
    if not existing:
        return FieldCheck(field="uniqueness", score=10, note="无已有角色, 无需检查")

    name = profile.get("name", "")
    role_type = profile.get("role_type", "")
    identity = profile.get("identity_summary", "")
    tags = " ".join(profile.get("personality_tags", []))

    issues = []
    for i, char in enumerate(existing):
        ep = char.get("character_profile", char)
        # 名字重复
        if name and ep.get("name", "") == name:
            issues.append(f"名字与角色#{i+1} '{ep.get('name', '')}' 重复")
        # 类型重复
        if role_type and ep.get("role_type", "") == role_type:
            # 允许同类型但要有差异
            existing_identity = ep.get("identity_summary", "")
            if identity and existing_identity:
                # 简单的关键词重叠检查
                id_kw = set(re.findall(r'[\u4e00-\u9fff]+', identity))
                ex_kw = set(re.findall(r'[\u4e00-\u9fff]+', existing_identity))
                overlap = id_kw & ex_kw
                if len(overlap) >= 3:
                    issues.append(f"与角色#{i+1} '{ep.get('name', '')}' 定位高度重叠: {', '.join(list(overlap)[:3])}")

    if not issues:
        return FieldCheck(field="uniqueness", score=10, note="与已有角色无明显重复")
    return FieldCheck(field="uniqueness", score=max(0, 10 - len(issues) * 3),
                      note="; ".join(issues))


def validate_character(role: dict, brief: dict = None, existing: list = None) -> ValidationResult:
    """验证单个角色"""
    profile = role.get("character_profile", {})
    image_spec = role.get("image_spec", {})

    categories = []

    # 1. Profile 完整性 (25%)
    profile_checks = []
    for f in REQUIRED_PROFILE_FIELDS:
        profile_checks.append(check_field_present(profile, f))
    profile_checks.append(check_role_type(profile))
    # 质量检查
    for f in ["identity_summary", "appearance_summary", "speech_style"]:
        profile_checks.append(check_field_quality(profile, f, min_len=6, label=f"{f}_quality"))
    profile_checks.append(check_field_quality(profile, "personality_tags", min_len=1))
    avg_profile = sum(c.score for c in profile_checks) / len(profile_checks)
    categories.append(CategoryScore(name="Profile 完整性", score=int(avg_profile * 10), checks=profile_checks))

    # 2. Image Spec 完整性 (25%)
    spec_checks = []
    for f in REQUIRED_IMAGE_SPEC_FIELDS:
        spec_checks.append(check_field_present(image_spec, f))
    spec_checks.append(check_image_prompt_quality(image_spec))
    avg_spec = sum(c.score for c in spec_checks) / len(spec_checks)
    categories.append(CategoryScore(name="Image Spec 完整性", score=int(avg_spec * 10), checks=spec_checks))

    # 3. Brief 遵循度 (30%)
    brief_check = check_brief_compliance(profile, brief)
    categories.append(CategoryScore(name="Brief 遵循度", score=brief_check.score, checks=[brief_check]))

    # 4. 独特性 (20%)
    unique_check = check_uniqueness(profile, existing or [])
    categories.append(CategoryScore(name="角色独特性", score=unique_check.score * 10, checks=[unique_check]))

    # 加权总分
    weights = [0.25, 0.25, 0.30, 0.20]
    total = sum(cat.score * w for cat, w in zip(categories, weights))
    total = int(total)

    if total >= 85:
        grade = "A 优秀"
    elif total >= 70:
        grade = "B 良好"
    elif total >= 55:
        grade = "C 及格"
    elif total >= 40:
        grade = "D 待改进"
    else:
        grade = "F 不合格"

    # 生成总结
    weak = [cat for cat in categories if cat.score < 60]
    if weak:
        summary = "薄弱项: " + ", ".join(f"{cat.name}({cat.score})" for cat in weak)
    else:
        summary = "各维度表现均衡"

    return ValidationResult(total_score=total, grade=grade, categories=categories, summary=summary)


# ── 输出格式化 ──────────────────────────────────────────

def format_check(c: FieldCheck, indent: str = "    ") -> str:
    bar = "█" * (c.score // 2) + "░" * (5 - c.score // 2)
    return f"{indent}{bar} [{c.score:2d}] {c.field}: {c.note}"


def format_result(name: str, result: ValidationResult) -> str:
    lines = []
    lines.append(f"{'='*60}")
    lines.append(f"  角色: {name}")
    lines.append(f"  总分: {result.total_score}/100  等级: {result.grade}")
    lines.append(f"  {result.summary}")
    lines.append(f"{'='*60}")

    for cat in result.categories:
        lines.append(f"\n  [{cat.name}] {cat.score}/100")
        for check in cat.checks:
            lines.append(format_check(check))

    lines.append(f"\n{'─'*60}")
    return "\n".join(lines)


# ── LLM 语义评判 ──────────────────────────────────────────

def llm_judge角色(role: dict, brief: dict, existing: list = None) -> dict:
    """调用 LLM 对角色与 brief 的匹配度做语义评判（含 image_spec）"""
    if not brief:
        return {"error": "no brief"}

    profile = role.get("character_profile", {})
    image_spec = role.get("image_spec", {})
    brief_json = json.dumps(brief, ensure_ascii=False, indent=2)
    profile_json = json.dumps(profile, ensure_ascii=False, indent=2)
    image_json = json.dumps(image_spec, ensure_ascii=False, indent=2)
    existing_info = ""
    if existing:
        names = [c.get("character_profile", c).get("name", "?") for c in existing]
        existing_info = f"\n已有角色: {', '.join(names)}"

    prompt = f"""评审角色（含视觉设定）与Brief匹配度。

Brief: {brief_json[:500]}

角色设定: {profile_json[:500]}

视觉设定(image_spec): {image_json[:800]}
{existing_info}

评审5个维度（每项0-10分）:
1. brief关联度: 人设是否服务brief世界观/主冲突/人物关系
2. 角色功能: 功能是否清晰、与已有角色互补
3. 爽感贡献: 能否提供打脸/反转/情绪宣泄
4. 视觉设定质量: image_spec各字段是否完整且与人设一致，image_prompt是否可直接出图
5. 潜在问题: 有无矛盾、重复、空泛

输出JSON（每个reason限10字内）:
{{"brief_relevance":{{"score":N,"reason":"简短"}},"role_completeness":{{"score":N,"reason":"简短"}},"drama_value":{{"score":N,"reason":"简短"}},"visual_quality":{{"score":N,"reason":"简短"}},"issues":{{"score":N,"reason":"简短"}},"overall_comment":"简短"}}

只输出JSON。"""

    # 读取项目配置获取 API 信息（直接从 SQLite 读取）
    api_base = "https://api.chatfire.site"
    api_key = ""
    model = "gpt-5-mini"  # 默认用 gpt-5-mini，qwen3.5-plus 的 reasoning tokens 会导致输出为空
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "video_lab.sqlite3")
        db_path = os.path.normpath(db_path)
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            for key, val in conn.execute("SELECT key, value FROM settings").fetchall():
                val = val.strip('"')
                if key == "api_base":
                    api_base = val
                elif key == "api_key":
                    api_key = val
                elif key == "text_model":
                    model = val
            conn.close()
    except Exception:
        pass
    # 环境变量可覆盖
    api_base = os.environ.get("VIDEO_LAB_API_BASE", api_base)
    api_key = os.environ.get("VIDEO_LAB_API_KEY", api_key)
    model = os.environ.get("VIDEO_LAB_TEXT_MODEL", model)

    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4000,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{api_base}/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            # 提取 JSON（更健壮的解析）
            content = content.strip()
            # 去掉 markdown 代码块
            if "```" in content:
                parts = content.split("```")
                for part in parts[1::2]:  # 取奇数位（代码块内容）
                    part = part.strip()
                    if part.startswith("json"):
                        part = part[4:].strip()
                    if part.startswith("{"):
                        content = part
                        break
            # 尝试找到第一个 { 到最后一个 }
            if not content.startswith("{"):
                start = content.find("{")
                end = content.rfind("}") + 1
                if start >= 0 and end > start:
                    content = content[start:end]
            return json.loads(content)
    except json.JSONDecodeError as e:
        # 返回原始内容供调试
        return {"error": f"JSON解析失败: {e}", "raw_content": content[:500] if 'content' in dir() else ""}
    except Exception as e:
        return {"error": str(e)}


def format_llm_result(name: str, llm_result: dict) -> str:
    """格式化 LLM 评判结果"""
    if "error" in llm_result:
        msg = f"  LLM 评判失败: {llm_result['error']}"
        if "raw_content" in llm_result:
            msg += f"\n  原始返回: {llm_result['raw_content'][:200]}"
        return msg

    lines = []
    dims = [
        ("brief_relevance", "Brief 关联度"),
        ("role_completeness", "角色功能完整性"),
        ("drama_value", "爽感贡献"),
        ("visual_quality", "视觉设定质量"),
        ("issues", "潜在问题"),
    ]
    total = 0
    for key, label in dims:
        d = llm_result.get(key, {})
        score = d.get("score", 0)
        total += score
        bar = "█" * score + "░" * (10 - score)
        lines.append(f"    {bar} [{score}/10] {label}")
        lines.append(f"           {d.get('reason', '')}")
        if d.get("suggestion"):
            lines.append(f"           💡 {d['suggestion']}")
    avg = total / len(dims)
    max_score = len(dims) * 10
    lines.append(f"\n    LLM 综合: {total}/{max_score} (平均 {avg:.1f}/10)")
    comment = llm_result.get("overall_comment", "")
    if comment:
        lines.append(f"    评语: {comment}")
    return "\n".join(lines)


# ── CLI ──────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    proposal_path = sys.argv[1]
    brief_path = None
    existing_path = None
    use_llm = False

    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == "--brief" and i + 1 < len(args):
            brief_path = args[i + 1]
            i += 2
        elif args[i] == "--existing" and i + 1 < len(args):
            existing_path = args[i + 1]
            i += 2
        elif args[i] == "--llm":
            use_llm = True
            i += 1
        else:
            i += 1

    # 加载数据
    with open(proposal_path, "r", encoding="utf-8") as f:
        proposal = json.load(f)

    brief = {}
    if brief_path and os.path.exists(brief_path):
        with open(brief_path, "r", encoding="utf-8") as f:
            brief = json.load(f)

    existing = []
    if existing_path and os.path.exists(existing_path):
        with open(existing_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    # 提取角色列表
    roles = []
    if "roles" in proposal:
        roles = proposal["roles"]
    elif "character_profile" in proposal:
        roles = [proposal]
    elif "base_character" in proposal:
        roles = [proposal["base_character"]]

    if not roles:
        print("错误: proposal 中没有找到角色数据")
        sys.exit(1)

    # 规则验证
    print(f"\n共 {len(roles)} 个角色待验证\n")
    all_results = []
    for role in roles:
        profile = role.get("character_profile", {})
        name = profile.get("name", "未命名角色")
        result = validate_character(role, brief, existing)
        print(format_result(name, result))
        all_results.append((name, result, role))

    # 汇总
    if len(all_results) > 1:
        avg_score = sum(r.total_score for _, r, _ in all_results) / len(all_results)
        print(f"\n{'='*60}")
        print(f"  规则验证汇总: {len(all_results)} 个角色, 平均分 {int(avg_score)}/100")
        for name, result, _ in all_results:
            print(f"    {name}: {result.total_score} ({result.grade})")
        print(f"{'='*60}")

    # LLM 语义评判
    if use_llm and brief:
        print(f"\n\n{'═'*60}")
        print(f"  LLM 语义评判（调用 API 中...）")
        print(f"{'═'*60}")
        for name, _, role in all_results:
            print(f"\n  ⟳ 评判: {name}...")
            llm_result = llm_judge角色(role, brief, existing)
            print(f"\n  [{name}] LLM 评判:")
            print(format_llm_result(name, llm_result))

        print(f"\n{'═'*60}\n")


if __name__ == "__main__":
    main()
