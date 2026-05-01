"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CopilotModuleAdapter } from "@/src/components/copilot/types";

interface ProjectCopilotValue {
  adapter: CopilotModuleAdapter | null;
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
  setAdapter: (adapter: CopilotModuleAdapter | null) => void;
}

const ProjectCopilotContext = createContext<ProjectCopilotValue | null>(null);

export function ProjectCopilotProvider({ children }: { children: React.ReactNode }) {
  const [adapter, setAdapter] = useState<CopilotModuleAdapter | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(() => ({
    adapter,
    isOpen,
    setIsOpen,
    setAdapter,
  }), [adapter, isOpen]);

  return <ProjectCopilotContext.Provider value={value}>{children}</ProjectCopilotContext.Provider>;
}

export function useProjectCopilot() {
  const value = useContext(ProjectCopilotContext);
  if (!value) throw new Error("useProjectCopilot must be used within ProjectCopilotProvider");
  return value;
}

export function useProjectCopilotModule(adapter: CopilotModuleAdapter | null) {
  const { setAdapter, setIsOpen } = useProjectCopilot();
  useEffect(() => {
    setAdapter(adapter);
  }, [adapter, setAdapter]);

  useEffect(() => () => {
    setIsOpen(false);
    setAdapter(null);
  }, [setAdapter, setIsOpen]);
}
