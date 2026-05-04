# Episode Generation (分集生成) Implementation Plan v2

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a new `episode` copilot module to AI Drama Lab, enabling story-first workflow: brief → character → episode → scene (per-episode).

**Architecture:** Follow the established copilot module pattern. Episodes are outlines only — each episode contains title, summary, goal, core_conflict, opening_hook, climax, ending_hook. Scenes become a sub-feature of episodes (generated per-episode), while the global scenes tab is retained for management.

**Tech Stack:** Python backend (FastAPI), Next.js frontend (React), SQLite, Chatfire LLM provider.

---

## Design Decisions

1. **Workflow order:** Story first — brief → character → episode → scene (per-episode)
2. **Episode generation input:** Brief + characters only (no scenes — story is free)
3. **Scene generation per-episode:** After episode confirmed, generate scenes for that episode
4. **Scene reuse:** Later episodes can reference existing scenes from the global library
5. **Generation modes:** Both batch (all episodes at once) and progressive (one at a time)
6. **Global scenes tab:** Retained — users can manage scenes independently

---

## Episode Data Model

The `episodes` table already exists in the database:

```
episodes:
  id, project_id, episode_no, title, summary, goal,
  core_conflict, opening_hook, climax, ending_hook,
  status, sort_order, created_at, updated_at
```

Episode proposal fields (what the LLM outputs):
- `episode_no` (int): Episode number in the season
- `title` (string): Episode title (Chinese)
- `summary` (string, 100-300 chars): Plot summary for this episode
- `goal` (string): What this episode achieves in the overall story
- `core_conflict` (string): Main dramatic conflict in this episode
- `opening_hook` (string): Opening scene hook (how the episode starts)
- `climax` (string): Episode climax moment
- `ending_hook` (string): Ending hook / cliffhanger for next episode

---

## Implementation Tasks

### Task 1: Add `episode` to Backend SUPPORTED_MODULES

**Objective:** Register episode as a valid copilot module type.

**Files:**
- Modify: `apps/backend/video_lab/routes/copilot.py`

**Step 1:** Add `"episode"` to SUPPORTED_MODULES set.

```python
SUPPORTED_MODULES = {"brief", "character", "scene", "episode"}
```

**Step 2:** Verify syntax.

Run: `cd /Users/mr.zhou/Desktop/video && python3 -c "from video_lab.routes.copilot import SUPPORTED_MODULES; print(SUPPORTED_MODULES)"`
Expected: `{'brief', 'character', 'scene', 'episode'}`

**Step 3:** Commit.

```bash
cd /Users/mr.zhou/Desktop/video
git add apps/backend/video_lab/routes/copilot.py
git commit -m "feat(backend): add episode to SUPPORTED_MODULES"
```

---

### Task 2: Create Episode Copilot Prompts

**Objective:** Create system prompt and user templates for episode generation.

**Files:**
- Create: `apps/backend/video_lab/prompts/copilot_episode/system.txt`
- Create: `apps/backend/video_lab/prompts/copilot_episode/generate.txt`
- Create: `apps/backend/video_lab/prompts/copilot_episode/rewrite.txt`
- Create: `apps/backend/video_lab/prompts/copilot_episode/regenerate.txt`

#### system.txt

```
你是一位专业的短剧分集编剧顾问，擅长为竖屏短剧设计紧凑、有张力的分集大纲。

【输出格式】
- 先用自然语言解释你的设计思路（200字以内）
- 然后输出结构化 JSON
- JSON 包裹在 ===PROPOSAL=== 和 ===END_PROPOSAL=== 标记之间

【两种输出模式】

batch 模式（批量生成）：
{
  "episodes": [
    {episode1},
    {episode2},
    ...
  ]
}

single 模式（单集生成）：
{
  "episode_no": 1,
  "title": "...",
  "summary": "...",
  "goal": "...",
  "core_conflict": "...",
  "opening_hook": "...",
  "climax": "...",
  "ending_hook": "..."
}

【单集字段说明】
- episode_no: 集数编号（从1开始）
- title: 集名（中文，简洁有力，4-8字）
- summary: 剧情概要（100-300字，描述本集主要剧情）
- goal: 本集在整体故事中的功能（推动主线/揭示伏笔/角色成长）
- core_conflict: 本集核心冲突（角色之间的矛盾或内心挣扎）
- opening_hook: 开场钩子（前3秒抓住观众的切入点）
- climax: 本集高潮时刻（最紧张/反转/爽点的瞬间）
- ending_hook: 结尾悬念（让人想看下一集的钩子）

【短剧分集设计原则】
- 每集控制在1-3分钟时长的信息量
- 每集必须有独立的冲突弧和爽点
- 集与集之间必须有递进关系（悬念升级或反转）
- opening_hook 必须在前3秒抓住观众
- ending_hook 必须让人想看下一集
- 整体围绕 brief 的 main_conflict 展开
- 角色出场要利用已有的 character 设定
- 遵循 brief 的 world_rules 和 reversal_rules
- 禁止违反 brief 的 forbidden_rules
- 每集要有至少一个"爽点"（打脸/反转/逆袭/揭真相）

【关于场景的处理】
- 分集大纲阶段不设计具体场景
- 场景将在分集确认后单独生成
- 但可以在 summary 和 opening_hook 中描述视觉氛围（如"雨夜""破旧酒吧"）
```

#### generate.txt

```
请为项目生成分集大纲。

【项目概要】
{context_json}

【用户要求】
{user_goal}

请基于以上项目信息，生成分集大纲。
确保每集之间有递进关系，整体围绕主线冲突展开。
每集都要有独立的冲突弧和爽点。
```

#### rewrite.txt

```
请改写以下分集的内容。

【当前分集信息】
{context_json}

【用户要求】
{user_goal}
```

#### regenerate.txt

```
请根据用户要求重新生成分集。

【当前分集信息】
{context_json}

【用户要求】
{user_goal}
```

**Step 5:** Commit.

```bash
cd /Users/mr.zhou/Desktop/video
git add apps/backend/video_lab/prompts/copilot_episode/
git commit -m "feat(backend): add episode copilot prompts"
```

---

### Task 3: Add Episode Normalization and Extraction in Backend

**Objective:** Add `_normalize_episode()`, `_extract_episode_proposal()` functions, and wire them into the copilot route.

**Files:**
- Modify: `apps/backend/video_lab/routes/copilot.py`

**Step 1:** Add normalize function (follow scene pattern):

```python
def _normalize_episode(raw: dict) -> dict:
    """Normalize a single episode object from LLM output."""
    return {
        "episode_no": int(raw.get("episode_no", 0)),
        "title": str(raw.get("title", "")),
        "summary": str(raw.get("summary", "")),
        "goal": str(raw.get("goal", "")),
        "core_conflict": str(raw.get("core_conflict", "")),
        "opening_hook": str(raw.get("opening_hook", "")),
        "climax": str(raw.get("climax", "")),
        "ending_hook": str(raw.get("ending_hook", "")),
    }
```

**Step 2:** Add extraction function (follow scene pattern):

```python
def _extract_episode_proposal(text: str) -> dict | None:
    """Extract episode proposal(s) from LLM response."""
    raw = _extract_json(text)
    if raw is None:
        return None
    # Batch mode: {"episodes": [...]}
    if "episodes" in raw and isinstance(raw["episodes"], list):
        episodes = [_normalize_episode(ep) for ep in raw["episodes"]]
        return {"episodes": episodes}
    # Single mode: one episode object
    if "title" in raw:
        return {"episodes": [_normalize_episode(raw)]}
    return None
```

**Step 3:** Add branch in `_extract_proposal()`:

```python
def _extract_proposal(module_type: str, text: str) -> dict | None:
    if module_type == "brief":
        return _extract_brief_proposal(text)
    elif module_type == "character":
        return _extract_character_proposal(text)
    elif module_type == "scene":
        return _extract_scene_proposal(text)
    elif module_type == "episode":
        return _extract_episode_proposal(text)
    return None
```

**Step 4:** Verify by checking imports and syntax:

Run: `cd /Users/mr.zhou/Desktop/video && python3 -c "from video_lab.routes.copilot import _extract_episode_proposal; print('OK')"`
Expected: `OK`

**Step 5:** Commit.

```bash
git add apps/backend/video_lab/routes/copilot.py
git commit -m "feat(backend): add episode normalize and extract functions"
```

---

### Task 4: Add EpisodeProposal Types to Frontend api.ts

**Objective:** Add TypeScript types for episode proposals.

**Files:**
- Modify: `apps/frontend/src/api.ts`

**Step 1:** Add EpisodeProposal interface (near existing Episode interface):

```typescript
export interface EpisodeProposal {
  episodeNo: number;
  title: string;
  summary: string;
  goal: string;
  coreConflict: string;
  openingHook: string;
  climax: string;
  endingHook: string;
}

export interface EpisodeCollectionProposal {
  episodes: EpisodeProposal[];
}
```

**Step 2:** Update CopilotModuleType:

```typescript
export type CopilotModuleType = "brief" | "character" | "scene" | "episode";
```

**Step 3:** Update CopilotProposal union:

```typescript
export type CopilotProposal =
  | BriefProposal
  | CharacterCollectionProposal
  | CharacterVariantCollectionProposal
  | SceneCopilotProposal
  | EpisodeCollectionProposal;
```

**Step 4:** Add normalize function:

```typescript
export function normalizeEpisodeCollectionProposal(
  raw: Record<string, unknown>
): EpisodeCollectionProposal {
  const episodes = Array.isArray(raw.episodes)
    ? raw.episodes.map((ep: Record<string, unknown>) => ({
        episodeNo: Number(ep.episode_no ?? ep.episodeNo ?? 0),
        title: String(ep.title ?? ""),
        summary: String(ep.summary ?? ""),
        goal: String(ep.goal ?? ""),
        coreConflict: String(ep.core_conflict ?? ep.coreConflict ?? ""),
        openingHook: String(ep.opening_hook ?? ep.openingHook ?? ""),
        climax: String(ep.climax ?? ""),
        endingHook: String(ep.ending_hook ?? ep.endingHook ?? ""),
      }))
    : [];
  return { episodes };
}
```

**Step 5:** Commit.

```bash
cd /Users/mr.zhou/Desktop/video
git add apps/frontend/src/api.ts
git commit -m "feat(frontend): add EpisodeProposal types and normalize function"
```

---

### Task 5: Create Episode Page Component

**Objective:** Create the episodes management page with copilot integration.

**Files:**
- Create: `apps/frontend/src/app/projects/[id]/episodes/page.tsx`

The page follows the scene page pattern but adapted for episodes:

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useProgressiveGeneration } from "@/hooks/useProgressiveGeneration";
import { SectionCard } from "@/components/ui/SectionCard";
import { ProjectCopilotShell } from "@/components/copilot/ProjectCopilotShell";
import {
  Episode, EpisodeProposal, EpisodeCollectionProposal,
  listEpisodes, createEpisode, updateEpisode, deleteEpisode,
  streamCopilot, listCharacters, listScenes, getProject,
} from "@/api";

export default function EpisodesPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<any>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [editing, setEditing] = useState<EpisodeFormState | null>(null);
  const [regenerateEpisode, setRegenerateEpisode] = useState<EpisodeFormState | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateInput, setRegenerateInput] = useState("");

  // Fetch data
  const refresh = useCallback(async () => {
    const [ep, ch, sc, pr] = await Promise.all([
      listEpisodes(projectId),
      listCharacters(projectId),
      listScenes(projectId),
      getProject(projectId),
    ]);
    setEpisodes(ep);
    setCharacters(ch);
    setScenes(sc);
    setProject(pr);
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Progressive generation
  const progressive = useProgressiveGeneration({
    projectId,
    moduleType: "episode",
    userMessage: "请生成下一集分集大纲",
    buildContext: () => buildEpisodeCopilotContext("single_refine", null),
    onConfirm: async (proposal) => {
      const col = proposal as EpisodeCollectionProposal;
      const ep = col.episodes[0];
      if (ep) {
        await createEpisode(projectId, {
          episodeNo: episodes.length + 1,
          title: ep.title,
          summary: ep.summary,
          goal: ep.goal,
          coreConflict: ep.coreConflict,
          openingHook: ep.openingHook,
          climax: ep.climax,
          endingHook: ep.endingHook,
          sortOrder: episodes.length,
        });
        await refresh();
      }
    },
  });

  // Batch generation handler
  const handleBatchGenerate = async () => {
    const context = buildEpisodeCopilotContext("collection", null);
    const count = project?.episodeCountPlanned || 8;
    const result = await streamCopilot({
      projectId,
      moduleType: "episode",
      intent: "generate",
      messages: [{ role: "user", content: `请为项目生成全部 ${count} 集分集大纲` }],
      context,
    });
    if (result.proposal) {
      const col = result.proposal as EpisodeCollectionProposal;
      for (const ep of col.episodes) {
        await createEpisode(projectId, {
          episodeNo: ep.episodeNo,
          title: ep.title,
          summary: ep.summary,
          goal: ep.goal,
          coreConflict: ep.coreConflict,
          openingHook: ep.openingHook,
          climax: ep.climax,
          endingHook: ep.endingHook,
          sortOrder: ep.episodeNo,
        });
      }
      await refresh();
    }
  };

  // Context builder — note: NO scenes in context (story first)
  const buildEpisodeCopilotContext = (mode: string, currentEpisode: Episode | null) => ({
    current_mode: mode,
    generation_mode: mode === "collection" ? "batch" : "single",
    project_summary: {
      name: project?.name,
      genre: project?.genre,
      episode_count_planned: project?.episodeCountPlanned,
    },
    brief_summary: project?.brief ? {
      logline: project.brief.logline,
      world_rules: project.brief.worldRules,
      main_conflict: project.brief.mainConflict,
      reversal_rules: project.brief.reversalRules,
      relationship_summary: project.brief.relationshipSummary,
    } : null,
    existing_characters: characters.map(c => ({
      name: c.name,
      role_type: c.roleType,
      identity_summary: c.identitySummary,
      personality_tags: c.personalityTags,
    })),
    current_episode: currentEpisode ? {
      episode_no: currentEpisode.episodeNo,
      title: currentEpisode.title,
      summary: currentEpisode.summary,
    } : null,
    existing_episodes: episodes.map(e => ({
      episode_no: e.episodeNo,
      title: e.title,
      summary: e.summary,
    })),
    locked_rules: { project_id: projectId, must_follow_brief: true },
  });

  return (
    <div className="space-y-6">
      <SectionCard
        title="分集大纲"
        actions={
          <>
            {!progressive.active ? (
              <button onClick={() => void handleBatchGenerate()}>
                AI 生成分集大纲
              </button>
            ) : (
              <button onClick={() => progressive.stop()}>
                停止生成
              </button>
            )}
          </>
        }
      >
        {/* Episode list */}
        {episodes.map(ep => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            onEdit={() => setEditing(toForm(ep))}
            onRegenerate={() => {
              setRegenerateEpisode(toForm(ep));
              setRegenerateOpen(true);
            }}
          />
        ))}

        {/* Progressive panel */}
        {progressive.proposal && (
          <ProgressiveEpisodePanel
            proposal={progressive.proposal}
            progressive={progressive}
          />
        )}
      </SectionCard>

      {/* Edit dialog */}
      {editing && (
        <EpisodeEditDialog
          episode={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* Regenerate dialog */}
      {regenerateOpen && regenerateEpisode && (
        <RegenerateEpisodeDialog
          episode={regenerateEpisode}
          input={regenerateInput}
          onInputChange={setRegenerateInput}
          onClose={() => setRegenerateOpen(false)}
          onConfirm={handleRegenerate}
        />
      )}
    </div>
  );
}
```

**Step 6:** Commit.

```bash
cd /Users/mr.zhou/Desktop/video
git add apps/frontend/src/app/projects/[id]/episodes/page.tsx
git commit -m "feat(frontend): create episodes page with copilot integration"
```

---

### Task 6: Add "Generate Scenes for Episode" Feature

**Objective:** Add a button in episode details to generate scenes for a specific episode.

**Files:**
- Modify: `apps/frontend/src/app/projects/[id]/episodes/page.tsx` (add button + handler)
- Modify: `apps/backend/video_lab/prompts/copilot_scene/generate.txt` (add episode_scene mode)
- Modify: `apps/backend/video_lab/prompts/copilot_scene/system.txt` (add episode_scene mode rules)

#### Backend changes:

Add a new mode to scene copilot prompts:

In `system.txt`, add a section for episode_scene mode:
```
【按分集生成场景模式】
当 current_mode 为 "episode_scene" 时：
- 根据分集的剧情需要设计场景
- 优先复用已有的 scene preset（检查 existing_scenes）
- 只有现有场景无法满足剧情时才创建新场景
- 场景设计要服务于本集的 opening_hook 和 core_conflict
- 每个场景的 image_prompt 要与剧情氛围一致
```

In `generate.txt`, add episode_scene template:
```
请为以下分集设计需要的场景。

【分集信息】
{context_json}

【用户要求】
{user_goal}

请根据分集剧情设计场景 preset。优先复用已有场景，不足时再新建。
```

#### Frontend changes:

Add a "为此集生成场景" button in each episode row:
```tsx
<button onClick={() => handleGenerateScenesForEpisode(episode)}>
  为此集生成场景
</button>
```

Add the handler:
```tsx
const handleGenerateScenesForEpisode = async (episode: Episode) => {
  const context = {
    current_mode: "episode_scene",
    generation_mode: "single",
    project_summary: { name: project?.name, genre: project?.genre },
    brief_summary: project?.brief ? { ... } : null,
    existing_characters: characters.map(c => ({ name: c.name, role_type: c.roleType })),
    existing_scenes: scenes.map(s => ({
      name: s.name,
      scene_type: s.sceneType,
      space_description: s.spaceDescription,
    })),
    current_episode: {
      episode_no: episode.episodeNo,
      title: episode.title,
      summary: episode.summary,
      goal: episode.goal,
      core_conflict: episode.coreConflict,
      opening_hook: episode.openingHook,
      climax: episode.climax,
      ending_hook: episode.endingHook,
    },
    locked_rules: { project_id: projectId, must_follow_brief: true },
  };
  const result = await streamCopilot({
    projectId,
    moduleType: "scene",
    intent: "generate",
    messages: [{ role: "user", content: `为此集生成需要的场景 preset` }],
    context,
  });
  if (result.proposal) {
    // Auto-persist scenes
    const col = result.proposal as SceneCollectionProposal;
    for (const scene of col.scenes) {
      await createScene(projectId, scene);
    }
    await refresh();
  }
};
```

**Step 7:** Commit.

```bash
cd /Users/mr.zhou/Desktop/video
git add apps/backend/video_lab/prompts/copilot_scene/
git add apps/frontend/src/app/projects/[id]/episodes/page.tsx
git commit -m "feat: add per-episode scene generation"
```

---

### Task 7: Verify Navigation and Routes

**Objective:** Ensure episodes page is accessible in the navigation.

**Files:**
- Check: `apps/frontend/src/components/ProjectWorkspaceLayout.tsx`

The navigation likely already has "分集" nav item. Verify it points to the correct route `/projects/${id}/episodes` and the page renders.

---

### Task 8: Verify Backend Episode CRUD API

**Objective:** Ensure backend has createEpisode, updateEpisode, deleteEpisode endpoints.

**Files:**
- Check: `apps/backend/video_lab/routes/projects.py`

The frontend api.ts already has `createEpisode`, `updateEpisode`, `deleteEpisode` functions defined. The backend routes likely exist. Verify they work correctly.

---

### Task 9: End-to-End Test

**Objective:** Full flow test.

**Steps:**
1. Start: `cd /Users/mr.zhou/Desktop/video && ./start.sh`
2. Open http://localhost:3000
3. Navigate to a project with brief + characters
4. Go to "分集" tab
5. Click "AI 生成分集大纲" — batch generate
6. Verify episodes appear in list
7. Click "渐进式生成" — progressive one-at-a-time
8. Test edit dialog
9. Test regenerate dialog
10. Click "为此集生成场景" — generate scenes for one episode
11. Go to "场景" tab — verify scenes appear in global library
12. Generate another episode — verify it can reference existing scenes

**Expected:** All generation, editing, and scene generation flows work correctly.

---

## Summary of Changes

| Area | Files | Action |
|------|-------|--------|
| Backend | routes/copilot.py | Add "episode" to SUPPORTED_MODULES, add normalize/extract functions |
| Prompts | prompts/copilot_episode/ | Create system.txt, generate.txt, rewrite.txt, regenerate.txt |
| Prompts | prompts/copilot_scene/ | Add episode_scene mode to system.txt and generate.txt |
| Frontend | api.ts | Add EpisodeProposal types, normalize function, update CopilotModuleType |
| Frontend | episodes/page.tsx | Create new page with copilot integration + per-episode scene generation |
| Frontend | ProjectWorkspaceLayout.tsx | Verify nav routing |

## Implementation Order

1. Task 1: Backend SUPPORTED_MODULES (1 min)
2. Task 2: Episode prompts (10 min)
3. Task 3: Backend normalize/extract (10 min)
4. Task 4: Frontend types (5 min)
5. Task 5: Episode page (30 min)
6. Task 6: Per-episode scene generation (15 min)
7. Task 7-8: Navigation and API verification (5 min)
8. Task 9: End-to-end test (10 min)

Total estimated time: ~86 minutes

---

## Updated Workflow Diagram

```
brief → character → episode (大纲) → scene (per-episode)
                        ↓
                   [全局场景库]
                        ↓
                   后续分集可复用
```

Key principle: Story drives scenes, not the other way around.
