"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { streamCopilot, type CopilotIntent, type CopilotProposal } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { useProjectCopilot } from "@/src/components/copilot/ProjectCopilotContext";

const DEFAULT_INTENT_LABELS: Record<CopilotIntent, string> = {
  generate: "生成",
  rewrite: "改写",
  expand: "扩写",
  compress: "压缩",
  fill_missing: "补全",
  regenerate: "重新生成",
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
  const [tab, setTab] = useState("chat");
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
      setTab("chat");
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

  useEffect(() => {
    if (proposal) setTab("proposal");
  }, [proposal]);

  if (!adapter) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-[620px] max-w-[calc(100vw-0.75rem)] overflow-hidden p-0 sm:max-w-[620px]">
          <SheetHeader className="border-b border-line bg-panel2/80 px-4 py-3">
            <SheetTitle>{adapter.title} Copilot</SheetTitle>
            <SheetDescription>{helperText}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-line px-4">
                <TabsList variant="line">
                  <TabsTrigger value="context">上下文</TabsTrigger>
                  <TabsTrigger value="chat">对话</TabsTrigger>
                  <TabsTrigger value="proposal">建议 {proposal ? "(1)" : ""}</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <TabsContent value="context" className="p-4">
                  <div className="space-y-3 text-[13px] leading-5 text-gray-300">
                    {adapter.renderContextSummary()}
                  </div>
                  <p className="mt-4 text-[11px] text-gray-500">Copilot 会基于当前模块状态生成建议，不会直接改库。</p>
                </TabsContent>

                <TabsContent value="chat" className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {supportedIntents.map((item) => (
                      <Button key={item} type="button" variant={intent === item ? "default" : "outline"} size="sm" onClick={() => setIntent(item)}>
                        {intentLabels[item]}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{composer?.inputLabel ?? "你的目标"}</Label>
                    <Textarea
                      className="min-h-[80px] text-sm"
                      placeholder={composer?.inputPlaceholder ?? "例如：根据这个短剧创意，先生成一版更有钩子的 Brief。"}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2.5 rounded-lg border border-line bg-panel2/50 px-3 py-2.5">
                    {messages.length ? messages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className="space-y-0.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                          {message.role === "user" ? "You" : "Copilot"}
                        </p>
                        <div className="whitespace-pre-wrap text-[13px] leading-5 text-gray-300">{message.content}</div>
                      </div>
                    )) : (
                      <p className="py-4 text-center text-[13px] text-gray-500">
                        {composer?.emptyConversationDescription ?? `输入创意或改写目标，Copilot 会返回可回填的 ${adapter.title} 草稿。`}
                      </p>
                    )}
                    {streamingText ? (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">Copilot</p>
                        <div className="whitespace-pre-wrap text-[13px] leading-5 text-gray-300">{streamingText}</div>
                      </div>
                    ) : null}
                  </div>

                  {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">{error}</div> : null}
                </TabsContent>

                <TabsContent value="proposal" className="p-4">
                  {proposal ? (
                    <div className="space-y-3">
                      {adapter.renderProposal({ proposal, selectedFields, toggleField })}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-[13px] text-gray-500">
                      发起对话后，这里会显示可回填的 {adapter.title} 建议。
                    </p>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            <div className="border-t border-line bg-panel px-4 py-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <Button onClick={handleSubmit} disabled={submitting || !input.trim()}>
                  {submitting ? "生成中..." : "发送"}
                </Button>
                {proposalStyle === "fieldSelection" && adapter.applyProposal ? (
                  <>
                    <Button variant="outline" disabled={!proposal} onClick={() => proposal && adapter.applyProposal?.(proposal, { mode: "all", fields: [] })}>
                      应用全部
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
              <div className="text-[11px] leading-5 text-gray-500">
                {proposalStyle === "fieldSelection"
                  ? "应用动作只更新页面表单；写入数据库需点击保存按钮。"
                  : "角色设计器先生成候选角色；加入角色库或载入编辑器后再保存。"}
              </div>
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
