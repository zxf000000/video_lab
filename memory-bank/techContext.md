# Tech Context

## 技术栈

### 后端

- Python
- WSGI / `wsgiref`
- SQLite
- 本地线程池/任务骨架
- Provider 插件式调用层

关键路径：

```text
apps/backend/app.py
apps/backend/video_lab/web.py
apps/backend/video_lab/routes/
apps/backend/video_lab/domain/
apps/backend/video_lab/db.py
apps/backend/video_lab/jobs.py
apps/backend/video_lab/pipeline.py
apps/backend/video_lab/providers/
```

### 前端

- Next.js 15 App Router
- React 18
- TypeScript
- TailwindCSS
- Radix UI / shadcn 风格组件
- Tabler Icons / lucide-react

关键路径：

```text
apps/frontend/app/
apps/frontend/src/api.ts
apps/frontend/src/components/project/
apps/frontend/src/components/copilot/
apps/frontend/src/components/ui/
```

## 本地启动

仓库根目录：

```bash
./start.sh
```

项目约定：每次完成代码或提示词修改后，都要从仓库根目录执行 `./start.sh` 重启项目。

后端默认：

```text
http://127.0.0.1:8000
```

前端默认：

```text
http://127.0.0.1:3000
```

## 数据目录

```text
data/video_lab.sqlite3
data/assets/
```

## 当前技术约束

- 仍以 SQLite 为主，不引入复杂数据库。
- 当前不做大规模框架重写。
- 旧 `services.py` / `repository.py` 需要兼容，但不应继续承载新业务。
- 前端 `src/api.ts` 已较大，继续扩功能前应考虑模块化拆分。
- Shell 启动时可能出现 zsh/powerlevel10k 输出干扰，但命令实际可执行。

## Git 状态记录

截至 2026-05-05：

- 工作区干净。
- 本地 `master` 领先远端 `origin/master` 2 个提交。
- 最近本地提交包括 TypeScript 类型清理和 shot prompt/sketch assets 改进。