const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

async function request(path: string, options: RequestInit & { headers?: Record<string, string> } = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return payload;
}

export function getApiBase() {
  return API_BASE;
}

export function listProjects() {
  return request("/api/projects");
}

export function createProject(input: any) {
  return request("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProject(projectId: any) {
  return request(`/api/projects/${projectId}`);
}

export function regenerateProject(projectId: any, keepStory = false) {
  return request(`/api/projects/${projectId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ keep_story: keepStory }),
  });
}

export function deleteProject(projectId: any) {
  return request(`/api/projects/${projectId}`, { method: "DELETE" });
}

export function listDeletedProjects() {
  return request("/api/projects/deleted");
}

export function restoreProject(projectId: any) {
  return request(`/api/projects/${projectId}/restore`, { method: "POST" });
}

export function permanentDeleteProject(projectId: any) {
  return request(`/api/projects/${projectId}/permanent`, { method: "DELETE" });
}

export function getShot(shotId: any) {
  return request(`/api/shots/${shotId}`);
}

export function updateStory(projectId: any, content: any) {
  return request(`/api/projects/${projectId}/story`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export function getStoryVersions(projectId: any) {
  return request(`/api/projects/${projectId}/story-versions`);
}

export function restoreStoryVersion(projectId: any, versionId: any) {
  return request(`/api/projects/${projectId}/story-versions/${versionId}/restore`, { method: "POST" });
}

// Screenplay
export function generateScreenplay(projectId: any) {
  return request(`/api/projects/${projectId}/screenplay`, { method: "POST" });
}

export function updateScreenplay(projectId: any, content: any, contentEn: any) {
  return request(`/api/projects/${projectId}/screenplay`, {
    method: "PUT",
    body: JSON.stringify({ content, content_en: contentEn }),
  });
}

export function getScreenplayVersions(projectId: any) {
  return request(`/api/projects/${projectId}/screenplay-versions`);
}

export function restoreScreenplayVersion(projectId: any, versionId: any) {
  return request(`/api/projects/${projectId}/screenplay-versions/${versionId}/restore`, { method: "POST" });
}

// Beats
export function generateBeats(projectId: any) {
  return request(`/api/projects/${projectId}/beats`, { method: "POST" });
}

export function updateBeats(projectId: any, content: any, contentEn: any) {
  return request(`/api/projects/${projectId}/beats`, {
    method: "PUT",
    body: JSON.stringify({ content, content_en: contentEn }),
  });
}

export function getBeatsVersions(projectId: any) {
  return request(`/api/projects/${projectId}/beats-versions`);
}

export function restoreBeatsVersion(projectId: any, versionId: any) {
  return request(`/api/projects/${projectId}/beats-versions/${versionId}/restore`, { method: "POST" });
}

// Partial regeneration
export function regenerateFromStage(projectId: any, fromStage: any) {
  return request(`/api/projects/${projectId}/regenerate-from`, {
    method: "POST",
    body: JSON.stringify({ from_stage: fromStage }),
  });
}

export function addShot(projectId: any, shotData: any) {
  return request(`/api/projects/${projectId}/shots/add`, {
    method: "POST",
    body: JSON.stringify(shotData),
  });
}

export function deleteShot(shotId: any) {
  return request(`/api/shots/${shotId}`, { method: "DELETE" });
}

export function reorderShots(projectId: any, shotIds: any) {
  return request(`/api/projects/${projectId}/shots/reorder`, {
    method: "PUT",
    body: JSON.stringify({ shot_ids: shotIds }),
  });
}

// Frame & video generation
export function generateAllFrames(projectId: any) {
  return request(`/api/projects/${projectId}/generate-all-frames`, { method: "POST" });
}

export function generateAllVideos(projectId: any) {
  return request(`/api/projects/${projectId}/generate-all-videos`, { method: "POST" });
}

export function updateShotPrompts(shotId: any, promptFields: any) {
  return request(`/api/shots/${shotId}/prompt`, {
    method: "POST",
    body: JSON.stringify(promptFields),
  });
}

export function updateShotPrompt(shotId: any, shotPrompt: any) {
  return updateShotPrompts(shotId, { shot_prompt: shotPrompt });
}

export function updateShotDuration(shotId: any, durationSeconds: any) {
  return request(`/api/shots/${shotId}/duration`, {
    method: "PUT",
    body: JSON.stringify({ duration_seconds: durationSeconds }),
  });
}

export function generateShotFrames(shotId: any) {
  return request(`/api/shots/${shotId}/frames`, { method: "POST" });
}

export function generateSingleFrame(shotId: any, frameType: any) {
  return request(`/api/shots/${shotId}/frames/${frameType}`, { method: "POST" });
}

export function generateShotVideo(shotId: any) {
  return request(`/api/shots/${shotId}/video`, { method: "POST" });
}

// Config
export function getConfig() {
  return request("/api/config");
}

export function updateConfig(data: any) {
  return request("/api/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getModels() {
  return request("/api/models");
}

export function addModel(category: any, id: any, label: any) {
  return request(`/api/models/${category}`, {
    method: "PUT",
    body: JSON.stringify({ id, label: label || id }),
  });
}

export function deleteModel(category: any, id: any) {
  return request(`/api/models/${category}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Prompts
export function getPrompts() {
  return request("/api/prompts");
}

export function updatePrompts(data: any) {
  return request("/api/prompts", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Characters
export function generateCharacters(projectId: any) {
  return request(`/api/projects/${projectId}/characters/generate`, { method: "POST" });
}

export function listCharacters(projectId: any) {
  return request(`/api/projects/${projectId}/characters`);
}

export function createCharacter(projectId: any, data: any) {
  return request(`/api/projects/${projectId}/characters`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCharacter(charId: any, data: any) {
  return request(`/api/characters/${charId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCharacter(charId: any) {
  return request(`/api/characters/${charId}`, { method: "DELETE" });
}

export function generateCharacterImage(charId: any) {
  return request(`/api/characters/${charId}/image`, { method: "POST" });
}

export function lockCharacter(charId: any, locked: any) {
  return request(`/api/characters/${charId}/lock`, {
    method: "POST",
    body: JSON.stringify({ locked }),
  });
}

// Scenes
export function generateScenes(projectId: any) {
  return request(`/api/projects/${projectId}/scenes/generate`, { method: "POST" });
}

export function listScenes(projectId: any) {
  return request(`/api/projects/${projectId}/scenes`);
}

export function createScene(projectId: any, data: any) {
  return request(`/api/projects/${projectId}/scenes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateScene(sceneId: any, data: any) {
  return request(`/api/scenes/${sceneId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteScene(sceneId: any) {
  return request(`/api/scenes/${sceneId}`, { method: "DELETE" });
}

export function generateSceneImage(sceneId: any) {
  return request(`/api/scenes/${sceneId}/image`, { method: "POST" });
}

// Chat streaming
export async function streamChat(messages: any, onDelta: any, onExtracted: any, onDone: any, onError: any) {
  try {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone?.();
          return;
        }
        try {
          const event = JSON.parse(data);
          if (event.type === "delta") {
            onDelta?.(event.content);
          } else if (event.type === "extracted") {
            onExtracted?.(event.project_params);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
    onDone?.();
  } catch (err) {
    onError?.(err);
  }
}

// Quick video generation
export function generateQuickVideo({ prompt, style, aspect_ratio, target_duration, image_urls, image_b64s, reference_image_urls, resolution, video_model }: any) {
  return request("/api/generate-video", {
    method: "POST",
    body: JSON.stringify({ prompt, style, aspect_ratio, target_duration, image_urls, image_b64s, reference_image_urls, resolution, video_model }),
  });
}

export function getQuickVideoStatus(taskId: any) {
  return request(`/api/generate-video/status?task_id=${taskId}`);
}

export function listQuickVideoTasks() {
  return request("/api/generate-video/tasks");
}

export function generateImage({ prompt, aspect_ratio, reference_image }: any) {
  return request("/api/generate-image", {
    method: "POST",
    body: JSON.stringify({ prompt, aspect_ratio, reference_image }),
  });
}

// Seedance 2.0
export function getSeedanceConfig() {
  return request("/api/seedance/config");
}

export function updateSeedanceConfig(data: any) {
  return request("/api/seedance/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function seedanceT2V({ prompt, aspect_ratio, resolution, duration, remove_watermark }: any) {
  return request("/api/seedance/t2v", {
    method: "POST",
    body: JSON.stringify({ prompt, aspect_ratio, resolution, duration, remove_watermark }),
  });
}

export function seedanceI2V({ prompt, images_list, aspect_ratio, resolution, duration, remove_watermark }: any) {
  return request("/api/seedance/i2v", {
    method: "POST",
    body: JSON.stringify({ prompt, images_list, aspect_ratio, resolution, duration, remove_watermark }),
  });
}

export function seedanceCharacter({ images_list, prompt, aspect_ratio, resolution, duration, remove_watermark }: any) {
  return request("/api/seedance/character", {
    method: "POST",
    body: JSON.stringify({ images_list, prompt, aspect_ratio, resolution, duration, remove_watermark }),
  });
}

export function getSeedanceStatus(taskId: any) {
  return request(`/api/seedance/status?task_id=${taskId}`);
}

export function listSeedanceTasks() {
  return request("/api/seedance/tasks");
}

// Kling 可灵
export function getKlingConfig() {
  return request("/api/kling/config");
}

export function updateKlingConfig(data: any) {
  return request("/api/kling/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function klingT2V({ prompt, model_name, aspect_ratio, duration, mode, negative_prompt, sound }: any) {
  return request("/api/kling/t2v", {
    method: "POST",
    body: JSON.stringify({ prompt, model_name, aspect_ratio, duration, mode, negative_prompt, sound }),
  });
}

export function klingI2V({ prompt, image, image_tail, model_name, aspect_ratio, duration, mode, negative_prompt, sound }: any) {
  return request("/api/kling/i2v", {
    method: "POST",
    body: JSON.stringify({ prompt, image, image_tail, model_name, aspect_ratio, duration, mode, negative_prompt, sound }),
  });
}

export function klingGenerateImage({ prompt, model_name, aspect_ratio, negative_prompt }: any) {
  return request("/api/kling/image", {
    method: "POST",
    body: JSON.stringify({ prompt, model_name, aspect_ratio, negative_prompt }),
  });
}

export function klingOmniImage({ prompt, negative_prompt, image_list, model_name, aspect_ratio, resolution, n }: any) {
  return request("/api/kling/omni-image", {
    method: "POST",
    body: JSON.stringify({ prompt, negative_prompt, image_list, model_name, aspect_ratio, resolution, n }),
  });
}

export function klingOmniVideo({ prompt, image_list, model_name, aspect_ratio, duration, mode }: any) {
  return request("/api/kling/omni-video", {
    method: "POST",
    body: JSON.stringify({ prompt, image_list, model_name, aspect_ratio, duration, mode }),
  });
}

export function getKlingStatus(taskId: any) {
  return request(`/api/kling/status?task_id=${taskId}`);
}

export function listKlingTasks() {
  return request("/api/kling/tasks");
}
