"use client";

import { IconSparkles } from "@tabler/icons-react";
import { useProjectCopilot } from "@/src/components/copilot/ProjectCopilotContext";
import ProjectCopilotShell from "@/src/components/copilot/ProjectCopilotShell";
import { Button } from "@/src/components/ui/button";

export default function ProjectCopilotButton({ label = "AI Copilot" }: { label?: string }) {
  const { adapter, setIsOpen } = useProjectCopilot();

  if (!adapter) return null;

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        <IconSparkles size={16} stroke={2} />
        {label}
      </Button>
      <ProjectCopilotShell />
    </>
  );
}
