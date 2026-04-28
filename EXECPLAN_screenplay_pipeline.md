# ExecPlan: Story -> Screenplay -> Beats -> Shots 链路

## 1. 目标

在现有 `story -> beats -> shots` 基础上，再增加一个“剧本化”中间层，把普通剧情段落先转成更结构化的剧本文本，再继续做 beat expansion 和分镜。

## 2. 范围

### In Scope

- 新增 screenplay 提示词阶段
- 在服务层把 `split_shots` 改为先生成 screenplay，再生成 beats，再拆 shots
- 扩展 provider 协议与实现
- 在 Prompt 配置页增加 screenplay 配置入口
- 增加相关测试

### Out of Scope

- 数据库存储 screenplay 文本
- 新的 screenplay 编辑界面
- 项目状态机新增 screenplay 状态

## 3. 核心思路

1. `story` 负责输出剧情段落
2. 新增 `expand_story_screenplay`，把剧情段落整理成更像剧本的文本
3. `expand_story_beats` 基于 screenplay 继续细化为 beats
4. `split_shots` 基于 beats 输出镜头 JSON
5. 任一中间层失败都回退到上一层文本，保证主链路不中断

## 4. 验收标准

- Prompt 配置页可编辑 screenplay 提示词
- `split_shots` 调用前会先执行 screenplay，再执行 beats
- screenplay 或 beats 失败时仍可 fallback 到上游文本
- 相关测试通过
