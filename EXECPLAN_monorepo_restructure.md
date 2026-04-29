# ExecPlan: 重构为前后端 Monorepo

## 1. 目标

将当前项目整理为清晰的 monorepo：

- 后端 Python API 放入 `apps/backend/`
- 前端 Next.js 应用放入 `apps/frontend/`
- 根目录只保留仓库级配置、启动脚本、Docker 编排、数据目录和文档

本次重构不改变业务功能，重点是目录边界、启动方式、Docker 配置和路径解析稳定性。

## 2. 范围

### In Scope

- 新建 `apps/backend/` 与 `apps/frontend/`
- 迁移后端入口、业务包和测试
- 迁移前端源码，排除嵌套 `.git`、依赖和构建产物
- 更新 `start.sh`
- 更新 `docker-compose.yml` 和 Dockerfile 路径
- 更新 README 与 `.gitignore`
- 验证后端导入、前端构建配置和敏感信息检查

### Out of Scope

- 业务功能改造
- 前端 UI 重设计
- 引入 pnpm/npm workspace
- 数据库迁移
- CI/CD 配置

## 3. 目标结构

```text
.
├── apps/
│   ├── backend/
│   │   ├── app.py
│   │   ├── video_lab/
│   │   ├── tests/
│   │   └── Dockerfile
│   └── frontend/
│       ├── app/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
├── data/
├── docs/
├── docker-compose.yml
├── start.sh
├── README.md
└── .gitignore
```

## 4. 实施步骤

### Phase 1: 目录迁移

- 创建 `apps/backend/` 和 `apps/frontend/`
- 将 `app.py`、`video_lab/`、`tests/`、`Dockerfile.backend` 迁移到 `apps/backend/`
- 将 `frontend/` 源码迁移到 `apps/frontend/`
- 不迁移 `frontend/.git`、`frontend/node_modules`、`frontend/.next`、`frontend/dist`、`frontend/test-results`

验收标准：

- 父仓库不再把 `frontend/` 识别为未跟踪嵌套仓库
- 源码位于 `apps/backend` 和 `apps/frontend`

### Phase 2: 路径修正

- 后端运行目录变更后仍使用仓库根目录的 `data/`
- 后端 prompt 文件继续从 `video_lab/prompts/` 读取
- 前端 API base 和测试配置保持可用

验收标准：

- 后端模块可以正常编译
- 路径不依赖用户当前 shell 所在目录

### Phase 3: 启动与容器

- 更新 `start.sh`
- 更新 `docker-compose.yml`
- 重命名 Dockerfile 为各 app 内部的 `Dockerfile`

验收标准：

- `./start.sh` 可从仓库根目录启动前后端
- `docker compose build` 能使用新路径

### Phase 4: 文档与检查

- 更新 README
- 更新 `.gitignore`
- 运行可用检查
- 提交前扫描 staged diff 中的敏感信息

验收标准：

- `git status` 中没有构建产物、依赖目录、嵌套 `.git`
- staged diff 未发现明显密钥或敏感配置

## 5. 风险与缓解

- 嵌套前端 Git 仓库可能被误提交为 submodule；通过只迁移源码文件并排除 `.git` 缓解
- 后端路径迁移可能影响 SQLite 和 assets；通过统一计算仓库根路径缓解
- Docker context 改变可能导致 COPY 路径失效；通过把 Dockerfile 移入 app 目录并更新 compose 缓解

## 6. 回滚策略

本次重构以文件移动和配置调整为主。如果验证失败，可通过 Git 查看 rename diff 并逐步还原相关路径调整。
