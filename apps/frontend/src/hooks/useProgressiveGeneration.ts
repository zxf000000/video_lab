"use client";

import { useEffect, useRef, useState } from "react";
import {
  streamCopilot,
  type CopilotModuleType,
  type CopilotProposal,
} from "@/src/api";

const STORAGE_PREFIX = "video_lab_progressive_";

function storageKey(projectId: number, moduleType: string) {
  return `${STORAGE_PREFIX}${projectId}_${moduleType}`;
}

interface UseProgressiveGenerationOptions {
  projectId: number;
  moduleType: CopilotModuleType;
  /** User message sent to copilot for each generation */
  userMessage: string;
  /** Function to build context for the copilot call */
  buildContext: () => Record<string, unknown>;
  /** Called when the user confirms a proposal. Receives the raw proposal. */
  onConfirm: (proposal: CopilotProposal) => Promise<void>;
}

interface UseProgressiveGenerationReturn {
  active: boolean;
  loading: boolean;
  proposal: CopilotProposal | null;
  streamText: string;
  start: () => void;
  stop: () => void;
  confirmAndNext: () => Promise<void>;
  confirmAndStop: () => Promise<void>;
  skip: () => void;
}

export function useProgressiveGeneration({
  projectId,
  moduleType,
  userMessage,
  buildContext,
  onConfirm,
}: UseProgressiveGenerationOptions): UseProgressiveGenerationReturn {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<CopilotProposal | null>(null);
  const [streamText, setStreamText] = useState("");

  // Use refs to hold latest callbacks — avoids dependency chain issues
  const buildContextRef = useRef(buildContext);
  const onConfirmRef = useRef(onConfirm);
  const projectIdRef = useRef(projectId);
  const moduleTypeRef = useRef(moduleType);
  const userMessageRef = useRef(userMessage);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Keep refs up to date
  buildContextRef.current = buildContext;
  onConfirmRef.current = onConfirm;
  projectIdRef.current = projectId;
  moduleTypeRef.current = moduleType;
  userMessageRef.current = userMessage;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Core fetch function — stable, no dependencies
  const fetchNext = useRef(async () => {
    if (!mountedRef.current || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setProposal(null);
    setStreamText("");

    try {
      let result: CopilotProposal | null = null;
      await streamCopilot(
        {
          moduleType: moduleTypeRef.current,
          projectId: projectIdRef.current,
          intent: "generate",
          messages: [
            {
              role: "user",
              content: userMessageRef.current,
            },
          ],
          context: buildContextRef.current(),
        },
        {
          onDelta: (event) => {
            if (mountedRef.current) {
              setStreamText((prev) => prev + event.content);
            }
          },
          onProposal: (event) => {
            result = event.proposal;
          },
          onError: (error) => {
            throw new Error(error);
          },
        },
      );

      if (!mountedRef.current) return;

      if (result) {
        setProposal(result);
      }
    } catch (err) {
      console.error("[progressive] fetchNext error:", err);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setStreamText("");
      }
    }
  }).current;

  const start = (() => {
    setActive(true);
    try {
      localStorage.setItem(storageKey(projectId, moduleType), "1");
    } catch { /* ignore */ }
    void fetchNext();
  });

  const stop = (() => {
    setActive(false);
    setProposal(null);
    setLoading(false);
    setStreamText("");
    fetchingRef.current = false;
    try {
      localStorage.removeItem(storageKey(projectId, moduleType));
    } catch { /* ignore */ }
  });

  const confirmAndNext = (async () => {
    if (!proposal) return;
    try {
      await onConfirmRef.current(proposal);
      if (mountedRef.current) {
        void fetchNext();
      }
    } catch {
      // Error handled by parent toast
    }
  });
  const confirmAndStop = (async () => {
    if (!proposal) { stop(); return; }
    try {
      await onConfirmRef.current(proposal);
      stop();
    } catch {
      // Error handled by parent toast
    }
  });

  const skip = (() => {
    void fetchNext();
  });

  // Auto-resume on mount only
  useEffect(() => {
    if (!projectId) return;  // Wait for project to load
    let wasActive = false;
    try {
      wasActive = localStorage.getItem(storageKey(projectId, moduleType)) === "1";
    } catch { /* ignore */ }

    if (wasActive) {
      setActive(true);
      void fetchNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);  // Re-check when projectId becomes available

  return {
    active,
    loading,
    proposal,
    streamText,
    start,
    stop,
    confirmAndNext,
    confirmAndStop,
    skip,
  };
}
