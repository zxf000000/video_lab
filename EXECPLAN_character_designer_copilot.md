# ExecPlan: Character Designer Copilot

## 1. 目标

把当前“单角色提案”式的角色 Copilot 升级成真正的角色设计器：

1. 用户基于 Brief 和一句描述，一次生成一组关键角色候选。
2. 候选角色可以逐个加入角色库。
3. 候选角色可以逐个载入编辑器，做单角色精修。
4. 已有角色仍然支持新增、编辑、删除。

## 2. 范围

### In Scope

- 角色 Copilot 从单角色 proposal 升级为“角色组 proposal”
- 前端角色页支持“批量生成候选角色 + 单角色回填”
- 前端 Copilot 壳子支持模块级文案和自定义 proposal 交互
- 后端 `character` copilot prompt 与 proposal 解析升级
- 每次改动后统一通过 `start.sh` 重启验证

### Out of Scope

- 角色图片生成
- 角色版本历史
- 角色关系图可视化
- 多角色批量覆盖数据库

## 3. 核心思路

### 3.1 角色生成分两种模式

1. `collection mode`
   - 当前没有指定单个角色时，Copilot 生成 3-6 个关键角色候选
   - 每个候选都是一张完整角色卡
   - 用户逐个选择“加入角色库”或“载入编辑器”

2. `single refine mode`
   - 当前正在编辑某个角色时，Copilot 只返回 1 个精修后的角色版本
   - 用户可以把结果回填到当前编辑表单，再手动保存

### 3.2 保留统一壳子，特化角色模块

统一保留：
- 右侧 Copilot 抽屉
- 上下文摘要
- 对话区
- 建议结果区

角色模块特化：
- 自定义 intent 标签
- 自定义输入提示语
- 自定义 proposal 渲染
- proposal 里显示多张角色卡，而不是字段列表

## 4. 数据与协议

### 4.1 前端 Copilot proposal

新增：

- `CharacterProposal`
- `CharacterCollectionProposal`

结构：

```ts
type CharacterProposal = {
  name: string;
  roleType: string;
  appearanceSummary: string;
  personalityTags: string[];
  speechStyle: string;
  negativeConstraints: string;
};

type CharacterCollectionProposal = {
  roles: CharacterProposal[];
};
```

### 4.2 后端 character proposal

`/api/copilot/stream` 在 `module_type=character` 下返回：

```json
{
  "type": "proposal",
  "proposal": {
    "roles": [
      {
        "name": "...",
        "role_type": "...",
        "appearance_summary": "...",
        "personality_tags": ["..."],
        "speech_style": "...",
        "negative_constraints": "..."
      }
    ]
  }
}
```

## 5. 交互设计

### 5.1 批量角色生成

角色页打开 Copilot 后：

- 默认意图：`生成角色组`
- 输入示例：
  - “根据当前 Brief 生成这部短剧最重要的 5 个角色”
  - “做一套更下沉、更夸张的角色组合”

建议结果区展示多张角色卡，每张卡提供：

- `加入角色库`
- `载入编辑器`

### 5.2 单角色精修

用户点击已有角色的“编辑”后：

- Copilot 上下文自动带入当前角色
- 默认意图切到 `改写当前角色`
- proposal 只返回一张角色卡

建议结果区按钮：

- `回填当前角色`
- `作为新角色加入`

## 6. 验收标准

- 角色页 Copilot 可以根据一句描述生成一组候选角色
- 候选角色至少支持逐个加入角色库
- 候选角色至少支持逐个载入编辑器
- 编辑已有角色时，Copilot 能针对当前角色给出单角色精修建议
- 现有角色的新增、编辑、删除不受影响
- 前端构建通过
- 后端语法检查通过
- 最后通过 `start.sh` 重启
