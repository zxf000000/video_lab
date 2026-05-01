"use client";

import type { ReactNode } from "react";
import type { CopilotIntent, CopilotModuleType, CopilotProposal } from "@/src/api";

export interface CopilotFieldDescriptor {
  key: string;
  label: string;
}

export interface CopilotComposerConfig {
  description?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  emptyConversationTitle?: string;
  emptyConversationDescription?: string;
  intentLabels?: Partial<Record<CopilotIntent, string>>;
}

export interface CopilotModuleAdapter {
  moduleType: CopilotModuleType;
  title: string;
  description: string;
  entityId?: number | null;
  composer?: CopilotComposerConfig;
  proposalStyle?: "fieldSelection" | "custom";
  buildContext: () => Record<string, unknown>;
  renderContextSummary: () => ReactNode;
  getSupportedIntents: () => CopilotIntent[];
  getProposalFields: (proposal: CopilotProposal) => CopilotFieldDescriptor[];
  renderProposal: (args: {
    proposal: CopilotProposal;
    selectedFields: string[];
    toggleField: (field: string) => void;
  }) => ReactNode;
  applyProposal?: (proposal: CopilotProposal, options: { mode: "all" | "fields"; fields: string[] }) => void;
}
