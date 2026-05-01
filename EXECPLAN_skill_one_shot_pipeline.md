# ExecPlan: idea-to-feishu-script 一步到位流水线

## 目标

把现有 skill 从“校验已有产物”升级成“一条命令完成运行目录初始化、prompt 包生成、状态汇总、条件校验、可选发布”的一键入口。

## 现状

- 已有子 agent 定义和 prompt 模板。
- 已有 bootstrap 脚本，能创建 run workspace。
- 已有 orchestrator，能对已有 brief / characters / scenes / script / review 做校验和可选发布。
- 缺口在于：
  - 没有统一的一键入口。
  - 没有 prompt pack 产物，无法把各子 agent 的执行输入系统化落盘。
  - 运行目录里缺少状态信息，难以判断“是还没生成，还是生成失败”。

## 实施步骤

1. 新增 `build_prompt_pack.py`
   - 输入 `--run-dir`
   - 读取模板和 run workspace
   - 产出 `prompts/*.md` 和 `prompts/manifest.json`
   - 明确每个子 agent 的输入、输出、目标文件

2. 新增 `run_one_shot.py`
   - 支持从 `idea.md` 一键创建 run workspace
   - 自动构建 prompt pack
   - 自动探测哪些交付物已准备好
   - 如果角色卡/场景库/剧本等已齐全，自动进入校验链
   - 如果传 `--publish` 且校验通过，继续发布

3. 增强 `bootstrap_run.py`
   - 初始化 `prompts/` 目录
   - 在 `run.json` 里记录状态字段
   - README 改成 one-shot 使用方式

4. 更新 `orchestrate_pipeline.py`
   - 复用统一的 run-dir 文件解析逻辑
   - 输出更明确的验证状态

5. 更新文档
   - `SKILL.md`
   - `ARCHITECTURE.md`
   - `agents/openai.yaml`

## 成功标准

- 一条命令可以完成：
  - run workspace 初始化
  - prompt 包生成
  - 生成状态探测
  - 已有产物的校验
  - 条件满足时的发布
- 输出 JSON 能直接说明当前卡在哪一层。
- 不依赖手工逐步“下一步”推进。
