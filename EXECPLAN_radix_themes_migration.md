# ExecPlan: Radix Themes Migration

## 1. 目标

把当前前端从“`Radix Primitive + 自定义样式 wrapper`”切换到“直接使用 `@radix-ui/themes` 作为基础 UI 层”。

目标结果：

1. 根布局由 `Theme` 托管；
2. 基础组件优先使用 `Radix Themes` 组件，而不是 unstyled primitives；
3. 业务页面尽量不改调用方式；
4. `Sheet` 这类 Themes 没有现成组件的场景，使用 Themes 的 `Dialog` 体系做兼容包装；
5. 每次修改后统一通过 `start.sh` 重启验证。

## 2. 范围

### In Scope

- 安装并接入 `@radix-ui/themes`
- 根布局引入 Themes 样式和 `Theme` Provider
- `button / badge / label / input / textarea`
- `dialog / alert-dialog / sheet`
- 保持现有 `CreateProjectDrawer`、`角色编辑弹窗`、`Copilot 抽屉` 等页面 API 基本稳定

### Out of Scope

- 全站视觉重设计
- 页面级 Tailwind 结构重写
- 废弃全部 Tailwind 样式
- 移除现有自定义颜色 token

## 3. 核心思路

### 3.1 根布局先 Theme 化

- 在 `app/layout.tsx` 引入 `@radix-ui/themes/styles.css`
- 用 `Theme` 包住 `AppShell`
- 统一设置 `accentColor / grayColor / radius / appearance`

### 3.2 保持上层 API，替换底层实现

业务页仍然继续使用：

- `<Button variant="secondary" size="sm" />`
- `<Input />`
- `<Dialog />`
- `<Sheet />`

但底层实现改成：

- `@radix-ui/themes` Button / Badge / TextField / TextArea / Dialog / AlertDialog
- `Sheet` 基于 Themes 的 `Dialog` 系列兼容实现

### 3.3 先保证运行，再逐步纯化

第一阶段允许 wrapper 里做少量 prop 映射和 className 兼容，先完成：

- 统一到 Themes
- 页面不炸
- 交互和动效恢复

后续再决定是否进一步把页面直接改成原生 Themes 写法。

## 4. 实施顺序

1. 安装 `@radix-ui/themes`
2. 根布局接入 `Theme`
3. 重写 `button / badge / label / input / textarea`
4. 重写 `dialog / alert-dialog / sheet`
5. 构建验证
6. `start.sh` 重启

## 5. 验收标准

- 前端构建通过
- `start.sh` 可正常启动前后端
- `CreateProjectDrawer` 弹窗可打开
- `角色编辑` 弹窗可打开
- `AI Copilot` 抽屉可打开
- `确认删除` 弹窗可打开
- 不再直接依赖 unstyled `@radix-ui/react-dialog` / `alert-dialog` / `tabs` 作为主 UI 呈现层
