"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { streamCopilot, type CopilotIntent, type CopilotProposal } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { Textarea } from "@/src/components/ui/textarea";
import { useProjectCopilot } from "@/src/components/copilot/ProjectCopilotContext";

const DEFAULT_INTENT_LABELS: Record<CopilotIntent, string> = {
  generate: "生成",
  rewrite: "改写",
  expand: "扩写",
  compress: "压缩",
  fill_missing: "补全",
};

export default function ProjectCopilotShell() {
  const { project } = useProjectWorkspace();
  const { adapter, isOpen, setIsOpen } = useProjectCopilot();
  const [intent, setIntent] = useState<CopilotIntent>("generate");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [streamingText, setStreamingText] = useState("");
  const [proposal, setProposal] = useState<CopilotProposal | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const proposalSectionRef = useRef<HTMLDivElement | null>(null);

  const supportedIntents = adapter?.getSupportedIntents() ?? [];
  const canApplySelected = proposal && selectedFields.length > 0;
  const composer = adapter?.composer;
  const intentLabels = {
    ...DEFAULT_INTENT_LABELS,
    ...(composer?.intentLabels ?? {}),
  };
  const proposalStyle = adapter?.proposalStyle ?? "fieldSelection";

  useEffect(() => {
    if (!adapter) {
      setIsOpen(false);
      setMessages([]);
      setStreamingText("");
      setProposal(null);
      setSelectedFields([]);
      setError("");
      setInput("");
      return;
    }
    const nextIntent = adapter.getSupportedIntents()[0] ?? "generate";
    setIntent(nextIntent);
    setMessages([]);
    setStreamingText("");
    setProposal(null);
    setSelectedFields([]);
    setError("");
    setInput("");
  }, [adapter?.moduleType, adapter?.entityId, setIsOpen]);

  const helperText = useMemo(() => {
    if (!adapter) return "";
    return `${adapter.title} Copilot 会基于当前模块上下文生成结构化建议，默认不会直接写库。`;
  }, [adapter]);

  useEffect(() => {
    if (!proposal) return;
    proposalSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [proposal]);

  function toggleField(field: string) {
    setSelectedFields((prev) => prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]);
  }

  async function handleSubmit() {
    if (!adapter || !project || !input.trim()) return;
    const outgoingMessages = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(outgoingMessages);
    setStreamingText("");
    setProposal(null);
    setSelectedFields([]);
    setError("");
    setSubmitting(true);
    const userInput = input.trim();
    setInput("");
    let assistantContent = "";

    try {
      await streamCopilot(
        {
          moduleType: adapter.moduleType,
          projectId: project.id,
          entityId: adapter.entityId ?? null,
          intent,
          messages: outgoingMessages,
          context: adapter.buildContext(),
        },
        {
          onDelta: (event) => {
            assistantContent += event.content;
            setStreamingText(assistantContent);
          },
          onProposal: (event) => {
            const fields = adapter.getProposalFields(event.proposal).map((item) => item.key);
            setProposal(event.proposal);
            setSelectedFields(fields);
          },
          onError: (nextError) => {
            setError(nextError);
          },
          onDone: () => {
            if (!assistantContent.trim()) return;
            setMessages((prev) => [...prev, { role: "assistant", content: assistantContent.trim() }]);
            setStreamingText("");
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setInput(userInput);
    } finally {
      setSubmitting(false);
    }
  }

  if (!adapter) return null;

  return (
    <>
      <Button variant="inverted" size="sm" onClick={() => setIsOpen(true)}>
        <IconSparkles size={16} stroke={2} />
        AI Copilot
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-[640px] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-[640px]">
          <SheetHeader className="border-b border-line bg-panel2/80 p-5">
            <SheetTitle>{adapter.title} Copilot</SheetTitle>
            <SheetDescription>{helperText}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5">
              <SectionCard title="上下文摘要" description="Copilot 会基于当前模块状态生成建议，不会直接改库。">
                {adapter.renderContextSummary()}
              </SectionCard>

              <SectionCard title="对话区" description="先告诉 Copilot 这次希望生成、改写、扩写还是补全。">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {supportedIntents.map((item) => (
                      <Button key={item} type="button" variant={intent === item ? "default" : "outline"} size="sm" onClick={() => setIntent(item)}>
                        {intentLabels[item]}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">{composer?.inputLabel ?? "你的目标"}</Label>
                    <Textarea
                      className="min-h-[120px]"
                      placeholder={composer?.inputPlaceholder ?? "例如：根据这个短剧创意，先生成一版更有钩子的 Brief。"}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3 rounded-[22px] border border-line bg-panel p-4">
                    {messages.length ? messages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                          {message.role === "user" ? "User" : "Copilot"}
                        </p>
                        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</div>
                      </div>
                    )) : (
                      <EmptyState
                        title={composer?.emptyConversationTitle ?? "还没有对话"}
                        description={composer?.emptyConversationDescription ?? `输入一句创意或改写目标，Copilot 会返回可回填的 ${adapter.title} 草稿。`}
                      />
                    )}
                    {streamingText ? (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Copilot</p>
                        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{streamingText}</div>
                      </div>
                    ) : null}
                  </div>
                  {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
                </div>
              </SectionCard>

              <div ref={proposalSectionRef}>
                <SectionCard title="建议结果区" description="AI 先产出结构化草稿，你确认后再应用到当前表单。">
                {proposal ? (
                  adapter.renderProposal({ proposal, selectedFields, toggleField })
                ) : (
                  <EmptyState title="还没有结构化建议" description={`发起一次对话后，这里会显示可回填的 ${adapter.title} proposal。`} />
                )}
                </SectionCard>
              </div>
            </div>

            <div className="border-t border-line bg-white p-5">
              <div className="mb-4 flex flex-wrap gap-3">
                <Button onClick={handleSubmit} disabled={submitting || !input.trim()}>
                  {submitting ? "生成中..." : "发送给 Copilot"}
                </Button>
                {proposalStyle === "fieldSelection" && adapter.applyProposal ? (
                  <>
                    <Button variant="outline" disabled={!proposal} onClick={() => proposal && adapter.applyProposal?.(proposal, { mode: "all", fields: [] })}>
                      应用全部建议
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canApplySelected}
                      onClick={() => proposal && adapter.applyProposal?.(proposal, { mode: "fields", fields: selectedFields })}
                    >
                      按字段应用
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                {proposalStyle === "fieldSelection"
                  ? "应用动作只会更新当前页面表单；真正写入数据库仍需你点击页面自己的保存按钮。"
                  : "角色设计器会先生成候选角色；你可以逐个加入角色库，或载入编辑器后再保存。"}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
