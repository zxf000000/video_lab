"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import ProjectWorkspaceLayout from "@/src/components/project/ProjectWorkspaceLayout";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  return <ProjectWorkspaceLayout projectId={Number(params.id)}>{children}</ProjectWorkspaceLayout>;
}
