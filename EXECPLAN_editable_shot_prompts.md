# ExecPlan: 镜头首尾帧与视频提示词可编辑化

## 1. 目标

将分镜板和单镜头详情页中的 `start_frame_prompt`、`end_frame_prompt`、`video_prompt` 改为可编辑 `textarea`，支持自动保存，并让视频生成时优先使用用户编辑后的 `video_prompt`。

## 2. 范围

### In Scope

- 为 `shots` 表新增 `video_prompt` 字段
- 新增镜头提示词更新接口，支持保存 `shot_prompt`、`start_frame_prompt`、`end_frame_prompt`、`video_prompt`
- 调整视频生成链路，优先使用 `video_prompt` 覆盖值
- 将分镜板 `ShotCard` 中的首帧/尾帧 prompt 改为 `textarea`
- 将单镜头详情页中的首帧/尾帧/视频提示词改为 `textarea`
- 为上述文本框增加自动保存与保存状态提示
- 补充后端与前端相关测试或最小校验

### Out of Scope

- 改造提示词模板系统
- 新增版本历史或撤销功能
- 批量编辑所有镜头提示词

## 3. 核心问题

- 当前只有 `shot_prompt` 可编辑且需要手动保存
- `start_frame_prompt` / `end_frame_prompt` 在分镜板中是只读文本，无法微调
- 当前没有独立的 `video_prompt` 覆盖字段，视频提示词只能由运行时模板拼接生成
- 编辑 prompt 后的保存体验偏重，不适合频繁小修

## 4. 实施方案

1. 数据层
   - 在 `shots` 表中新增 `video_prompt TEXT DEFAULT ''`
   - 为 repository 增加统一的镜头提示词更新方法
   - 更新序列化返回，使前端拿到 `video_prompt`

2. 服务与 API
   - 新增或扩展镜头 prompt 更新接口，接收多个字段
   - 保存任一 prompt 字段后，清理已有首尾帧和视频产物，并置为 `prompt_updated`
   - `generate_shot_video()` 调用 provider 时优先使用 `shot.video_prompt`，为空时回退到 `shot.shot_prompt`

3. 前端交互
   - 分镜板 `ShotCard`：
     - `start_frame_prompt` / `end_frame_prompt` 改为 `textarea`
     - 新增 `video_prompt` `textarea`
     - 使用自动保存，输入停止后提交
   - 单镜头详情页：
     - 保留 `shot_prompt`
     - 新增首帧/尾帧/视频提示词编辑区
     - 使用统一自动保存逻辑与保存状态提示

4. 自动保存策略
   - 输入后 debounce 触发保存
   - 保存中显示状态
   - 保存成功后同步最新 shot 数据
   - 如果服务返回错误，保留当前输入并展示错误

## 5. 验收标准

- 分镜板和单镜头详情页中，首帧/尾帧/视频提示词都能直接编辑
- 编辑停止后会自动保存，无需手动点击
- 保存后页面状态能正确更新，并标记已有产物失效
- 视频生成时能优先使用用户编辑后的 `video_prompt`

## 6. 风险与缓解

- 风险：自动保存过于频繁，产生大量请求
  缓解：使用 debounce，只在停止输入后提交

- 风险：局部保存覆盖用户未完成编辑
  缓解：只同步当前字段未处于脏状态的值，避免无条件用服务端数据回填
