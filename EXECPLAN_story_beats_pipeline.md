# ExecPlan: Story -> Beats -> Shots 中间层改造

## 1. 目标

将当前 `story -> shots` 链路改为 `story -> beat expansion -> shots`，让分镜阶段拿到更丰满、更可拆分的剧情节拍输入，而不是直接硬拆原始段落。

## 2. 范围

### In Scope

- 新增 beat expansion 提示词阶段
- 在服务层把 `split_shots` 改为先扩写 beats，再生成 shots
- 扩展 provider 协议与实现
- 在 Prompt 配置页增加 beat expansion 配置入口
- 增加相关测试

### Out of Scope

- 数据库新增 beats 存储表
- 新的前端 beats 编辑界面
- 项目状态机重构

## 3. 核心思路

1. `story` 仍负责生成剧情段落
2. 新增 `expand_story_beats`，把剧情段落展开成结构化 beat 文本
3. `split_shots` 使用 beat 文本而不是原始 story 作为输入
4. 如果 beat expansion 失败，则降级回原始 story，保证链路不中断

## 4. 验收标准

- Prompt 配置页可编辑 beat expansion 提示词
- `split_shots` 调用前会先执行 beat expansion
- beat expansion 失败时仍可正常 fallback 到原 story 分镜
- 相关测试通过
