# Active Context

## 当前工作焦点

当前完成了角色参考图生成策略调整：角色图片生成阶段产出 **铅笔素描/黑白线稿参考图**；后续首帧图和视频生成阶段在提示词层面把素描参考恢复为 **真实真人写实影像**。

最近一次架构梳理结论：

- 项目已经从 Video Lab MVP 演进为 AI 短剧工业化生产工作台。
- 当前主链路是 Brief -> Assets -> Episodes -> Shots -> Prompts -> Generation -> Review -> Export。
- Copilot 是重要交互层，已覆盖 brief / character / scene / episode / shot。
- 后端 domain 架构已开始落地，但 legacy `services.py` / `repository.py` 仍很重。
- 前端 `src/api.ts` 已超过 1700 行，是明显拆分点。

## 近期已知进展

- 新增或强化了 episode Copilot 和 scenes Copilot。
- 修复过 episode batch generation 和 SSE buffer。
- 增强了 shot prompts 和 sketch assets。
- 前端消除了大量 `any` 类型，补充了 TypeScript interfaces。
- 已建立 Memory Bank，并更新 README 到当前 AI 短剧生产工作台定位。
- 角色图片生成提示词已强制偏向素描参考图；首帧/视频生成提示词已追加“素描参考恢复为真人写实”的约束。

## 当前优先级

1. 建立 Memory Bank。
2. 更新 README，避免文档继续停留在旧 MVP 描述。
3. 验证单集主链路：Episodes -> Shots -> Prompts -> Generation。
4. 拆分前端 `src/api.ts`。
5. 收敛后端 domain modules，减少 legacy 文件新增逻辑。

## 重要决策

- 不做大重构；采用渐进式收敛。
- 新业务优先放入 domain modules。
- 单集闭环优先于完整多轨视频编辑。
- Copilot proposal 必须结构化，能被前端回填/落库。
- 角色资产图先作为稳定身份用的素描参考图，不直接追求真人最终效果。
- 首帧图和视频生成必须把角色素描参考解释为身份/五官/发型/服装/体型/轮廓信息，并恢复成真实真人写实影像。
- 每次完成代码或提示词修改后，都要执行 `./start.sh` 重启项目进行运行验证。