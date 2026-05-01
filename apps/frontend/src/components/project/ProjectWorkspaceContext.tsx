"use client";

import { createContext, useContext } from "react";
import type { ProjectDetail } from "@/src/api";

export interface ProjectWorkspaceValue {
  projectId: number;
  project: ProjectDetail | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

export const ProjectWorkspaceContext = createContext<ProjectWorkspaceValue | null>(null);

export function useProjectWorkspace() {
  const value = useContext(ProjectWorkspaceContext);
  if (!value) throw new Error("useProjectWorkspace must be used within ProjectWorkspaceContext");
  return value;
}
