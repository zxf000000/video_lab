#!/usr/bin/env python3
"""
测试 video_prompt 生成质量的脚本。

功能：
  1. 调用 /api/shots/{shot_id}/generate-prompt 接口生成 prompt
  2. 检查 video_prompt 是否包含 6 要素 + sketch 复原声明位置
  3. 输出逐项检查结果和完整 prompt 文本

用法：
  python3 scripts/test_video_prompt.py <shot_id> [--base-url http://127.0.0.1:8000]

示例：
  python3 scripts/test_video_prompt.py 2282
  python3 scripts/test_video_prompt.py 2281 --base-url http://127.0.0.1:8000
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError


DB_PATH = "data/video_lab.sqlite3"


def fetch_shot_meta(shot_id: int) -> dict | None:
    """从 SQLite 读取镜头元数据（对白、角色、时长等）。"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM shots WHERE id = ?", (shot_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)

    # 查角色信息（characters 通过 project_id 关联）
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    project_id = d.get("project_id")
    chars = conn.execute(
        "SELECT name, speech_style, personality_tags "
        "FROM characters WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    conn.close()
    d["_characters"] = [dict(c) for c in chars]
    return d


def generate_prompt(shot_id: int, base_url: str, with_first_frame: bool = False) -> dict | None:
    """调用 API 生成 prompt，返回 JSON 响应。"""
    url = f"{base_url}/api/shots/{shot_id}/generate-prompt"
    payload = json.dumps({"with_first_frame": with_first_frame}).encode()
    req = Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        start = time.time()
        resp = urlopen(req, timeout=120)
        elapsed = time.time() - start
        data = json.loads(resp.read())
        data["_elapsed"] = round(elapsed, 1)
        return data
    except URLError as e:
        print(f"  API 请求失败: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  JSON 解析失败: {e}")
        return None


def check_video_prompt(vp: str, has_dialogue: bool) -> dict:
    """对 video_prompt 文本逐项检查，返回每项是否通过。"""
    return {
        # Layer 0 checks
        "初始画面(第0秒)": bool(re.search(r"(初始画面|画面初始|^画面初始)", vp)),
        "时间线分段": bool(re.search(r"\d+[-~]\d+\.?\d*\s*秒", vp)),
        "起幅/落幅": bool(re.search(r"(起幅|落幅|固定机位|镜头固定|保持固定|无.*?位移|不推不拉)", vp)),
        "英文关键词": bool(re.search(r"Technical\s*keywords", vp, re.IGNORECASE)),
        "对白音色": (
            True
            if not has_dialogue
            else bool(re.search(r"(音色|夹子|醇厚|低沉|慵懒|播音腔|破防|心虚|紧绷)", vp))
        ),
        "真实人像关键词": bool(re.search(r"(真实人像|还原为真实|非插画|真实.*质感|写实.*摄影)", vp)),
        "写实质感融入角色": bool(re.search(r"(真实肤色|自然发丝|发丝.*光泽|材质.*纹理|电影级.*光|写实.*光|真实.*材质|真实.*布料)", vp)),
        "写实描述在关键词之前": _check_sketch_before_keywords(vp),
        "无元指令泄漏": "提取其面部结构" not in vp,
        "无末尾 使用说明 附录": "角色参考图使用说明" not in vp and "参考图使用说明" not in vp,
        # Layer 1 checks
        "前景/背景分层": bool(re.search(r"(前景|后景|背景|主体|群演|分列|通道|虚化.*静止)", vp)),
        "Z轴纵深": bool(re.search(r"(纵深|推近|拉远|推向|退离|前景.*(移动|滑出|偏移)|背景.*(移动|缓移|上移)|走近|退远)", vp)),
        "手部动作": bool(re.search(r"(右手|左手|双手|手[指掌握抬挥蜷臂腕]|手指|握手|抬手|手部|指尖|手臂)", vp)),
        "物理重量感": bool(re.search(r"(布料|发丝|呼吸|垂坠|摆荡|飘动|起伏|裙摆|光泽)", vp)),
        "视线引导": bool(re.search(r"(视线|看向|望向|目光|注意力|目光|眼神盯|眯眼|注视)", vp)),
        # Layer 3 checks
        "色调/光温描述": bool(re.search(r"(色调|色温|暖色|冷色|暖金|冷蓝|冷亮|冷调|暖调|光温|中性光|黄金时刻|日光|灯光.*色)", vp)),
        "节奏曲线意识": bool(re.search(r"(节奏|紧凑|放缓|建立情境|冲突|反应|落点|前.*秒.*慢|后.*秒.*缓)", vp)),
        "180°轴线意识": bool(re.search(r"(轴线|越轴|同侧|同一侧|视线方向.*一致|上一镜.*角度|机位.*保持|保持.*侧拍|保持.*角度)", vp)),
    }


def _check_sketch_before_keywords(vp: str) -> bool:
    """验证写实描述出现在 Technical keywords 之前。"""
    sketch_m = re.search(r"(真实肤色|自然发丝|发丝.*光泽|材质.*纹理|电影级.*光|写实.*光|真实.*材质|真实.*布料|面部结构)", vp)
    kw_m = re.search(r"Technical\s*keywords", vp, re.IGNORECASE)
    if not sketch_m or not kw_m:
        return False
    return sketch_m.start() < kw_m.start()


def print_meta(meta: dict):
    """打印镜头元信息。"""
    print(f"  镜头 ID:     {meta['id']}")
    print(f"  shot_no:     {meta.get('shot_no')}")
    print(f"  景别:        {meta.get('shot_size')}")
    print(f"  运镜:        {meta.get('camera_motion')}")
    print(f"  场次:        {meta.get('scene_block')}")
    print(f"  预估时长:    {meta.get('estimated_duration_ms', 0)}ms")
    dialogue = meta.get("dialogue_excerpt", "") or ""
    print(f"  对白:        {dialogue[:80]}{'...' if len(dialogue) > 80 else ''}")
    if meta.get("_characters"):
        print("  角色音色:")
        for c in meta["_characters"]:
            print(f"    {c['name']}: {c.get('speech_style', 'N/A')[:60]}")


def main():
    parser = argparse.ArgumentParser(
        description="测试 video_prompt 生成质量，检查 6 要素 + sketch 复原声明位置"
    )
    parser.add_argument("shot_id", type=int, help="镜头 ID")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="后端地址")
    parser.add_argument("--with-first-frame", action="store_true", help="是否带入首帧图片")
    args = parser.parse_args()

    # 1. 查元数据
    print(f"\n{'='*60}")
    print(f"镜头 {args.shot_id} 元数据")
    print(f"{'='*60}")
    meta = fetch_shot_meta(args.shot_id)
    if not meta:
        print(f"错误: 未找到镜头 {args.shot_id}")
        sys.exit(1)
    print_meta(meta)

    has_dialogue = bool(meta.get("dialogue_excerpt", "").strip())

    # 2. 调 API
    print(f"\n{'='*60}")
    print(f"生成 prompt (耗时取决于 LLM)...")
    print(f"{'='*60}")
    result = generate_prompt(args.shot_id, args.base_url, args.with_first_frame)
    if not result:
        sys.exit(1)

    elapsed = result.pop("_elapsed", "?")
    print(f"  耗时: {elapsed}s")
    print(f"  duration_seconds: {result.get('duration_seconds')}")

    # 3. 检查 video_prompt
    vp = result.get("video_prompt", "")
    print(f"\n{'='*60}")
    print(f"video_prompt 逐项检查")
    print(f"{'='*60}")
    checks = check_video_prompt(vp, has_dialogue)
    all_pass = True
    for name, passed in checks.items():
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_pass = False
        print(f"  [{status}] {name}")
    print(f"  {'─'*40}")
    print(f"  总计: {sum(1 for v in checks.values() if v)}/{len(checks)} 通过")

    # 4. 打印完整 video_prompt
    print(f"\n{'='*60}")
    print(f"video_prompt 全文 ({len(vp)} 字)")
    print(f"{'='*60}")
    print(vp)

    # 5. 可选: 打印 first_frame_prompt 摘要
    ff = result.get("first_frame_prompt", "")
    if args.with_first_frame or ff:
        print(f"\n{'='*60}")
        print(f"first_frame_prompt 全文 ({len(ff)} 字)")
        print(f"{'='*60}")
        print(ff)

    # 6. 汇总
    print(f"\n{'='*60}")
    if all_pass:
        print("全部检查通过")
    else:
        print("存在未通过的检查项，详见上方 [FAIL] 标记")
    print(f"{'='*60}\n")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
