"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { createProject, streamChat, type ChatMessage } from "../api";
import { ActionButton, StatusBadge } from "./ui-legacy";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { IconX, IconSend, IconArrowLeft, IconCheck } from "@tabler/icons-react";

const STYLE_PRESETS = [
  { id: "cinematic", label: "电影感" },
  { id: "anime", label: "动漫风" },
  { id: "documentary", label: "纪录片" },
  { id: "neo-noir", label: "赛博朋克" },
  { id: "watercolor", label: "水彩画" },
  { id: "realistic", label: "写实风" },
];

const RATIOS = ["16:9", "9:16", "1:1", "4:3"];

const STARTER_MESSAGES: ChatMessage[] = [
  { role: "user", content: "你好，我想创建一个视频项目" },
];

interface ExtractedParams {
  title: string;
  story_prompt: string;
  style: string;
  aspect_ratio: string;
  target_duration: number;
  [key: string]: unknown;
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedParams, setExtractedParams] = useState<ExtractedParams | null>(null);
  const [creating, setCreating] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [streamingContent, messages, scrollToBottom]);

  useEffect(() => {
    if (open && !hasStarted) {
      setHasStarted(true);
      sendMessages(STARTER_MESSAGES);
    }
  }, [open, hasStarted]);

  function reset() {
    setMessages([]);
    setInput("");
    setStreamingContent("");
    setIsStreaming(false);
    setExtractedParams(null);
    setCreating(false);
    setHasStarted(false);
  }

  function handleClose() {
    if (creating || isStreaming) return;
    reset();
    onClose();
  }

  function sendMessages(msgs: ChatMessage[]) {
    console.log("[sendMessages] called with", msgs.length, "messages");
    setIsStreaming(true);
    setStreamingContent("");
    let accumulated = "";

    streamChat(
      msgs,
      (delta) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      },
      (params) => {
        setExtractedParams(params as ExtractedParams);
      },
      () => {
        setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
        setStreamingContent("");
        setIsStreaming(false);
      },
      (err) => {
        toast.error(String((err as Error).message || err));
        setIsStreaming(false);
      }
    );
  }

  function handleSend() {
    const text = input.trim();
    console.log("[handleSend] text:", text, "isStreaming:", isStreaming);
    if (!text || isStreaming) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: text }];
    console.log("[handleSend] sending", newMessages.length, "messages");
    setMessages(newMessages);
    sendMessages(newMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCreate() {
    if (!extractedParams) return;
    setCreating(true);
    try {
      const payload = await createProject({
        name: extractedParams.title,
        genre: "other",
        targetPlatform: "web",
        episodeCountPlanned: 1,
        logline: extractedParams.story_prompt,
        targetAudience: "general",
        genreTags: [],
        styleKeywords: extractedParams.style ? [extractedParams.style] : [],
      });
      reset();
      onClose();
      toast.success("项目已创建，AI 正在生成中...");
      router.push(`/projects/${payload.project.id}?tab=overview`);
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
      setCreating(false);
    }
  }

  function updateParam(field: string, value: string | number) {
    setExtractedParams((prev) => prev ? { ...prev, [field]: value } : null);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" showCloseButton={false} className="w-full max-w-3xl border-l border-line bg-panel p-0">
        <SheetTitle className="sr-only">对话式创建</SheetTitle>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Chat Create</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-100">对话式创建</h2>
          </div>
          {extractedParams && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700">
              参数已提取
            </span>
          )}
          <button
            className="shrink-0 rounded-full bg-panel2 px-2.5 py-1 text-xs text-gray-500 transition hover:text-gray-100 disabled:opacity-30"
            onClick={handleClose}
            disabled={creating || isStreaming}
          >
            <IconX size={14} stroke={2} />
          </button>
        </div>

        {!extractedParams ? (
          /* Chat Mode */
          <div className="flex flex-1 flex-col" style={{ height: "calc(100vh - 65px - 60px)" }}>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        msg.role === "user"
                          ? "bg-mint text-white"
                          : "bg-panel2 text-gray-300"
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    </div>
                  </div>
                ))}

                {streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-panel2 px-4 py-3 text-sm leading-6 text-gray-300">
                      <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
                      <span className="inline-block h-4 w-0.5 animate-pulse bg-mint align-middle" />
                    </div>
                  </div>
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-line px-5 py-3">
              <div className="flex gap-2">
                <Textarea
                  className="min-h-[44px] flex-1 resize-none rounded-2xl py-2.5 text-sm"
                  placeholder="描述你想要的视频..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  rows={1}
                />
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint text-white transition hover:opacity-90 disabled:opacity-30"
                  onClick={handleSend}
                  disabled={isStreaming || !input.trim()}
                >
                  <IconSend size={16} stroke={2} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">AI 已提取以下参数，确认后创建项目</p>
                <StatusBadge status="ready" className="bg-purple-500/10 text-mint" />
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel2 p-5">
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">项目名</label>
                  <Input
                    className="rounded-xl"
                    type="text"
                    value={extractedParams.title}
                    onChange={(e) => updateParam("title", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">剧情需求</label>
                  <Textarea
                    className="min-h-[120px] resize-y"
                    value={extractedParams.story_prompt}
                    onChange={(e) => updateParam("story_prompt", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs text-gray-500">风格</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLE_PRESETS.map((s) => {
                      const active = extractedParams.style === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            active
                              ? "border-mint bg-mint/10 text-mint"
                              : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                          }`}
                          onClick={() => updateParam("style", s.id)}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs text-gray-500">画面比例</label>
                    <div className="grid grid-cols-2 gap-2">
                      {RATIOS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`rounded-xl border py-2 text-sm font-medium transition ${
                            extractedParams.aspect_ratio === r
                              ? "border-mint bg-mint/10 text-mint"
                              : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                          }`}
                          onClick={() => updateParam("aspect_ratio", r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs text-gray-500">目标时长（秒）</label>
                    <Input
                      className="rounded-xl"
                      type="number"
                      min={5}
                      max={120}
                      value={extractedParams.target_duration}
                      onChange={(e) => updateParam("target_duration", Number(e.target.value))}
                    />
                    <div className="mt-2 flex gap-2">
                      {[15, 30, 60, 90].map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`rounded-lg border px-3 py-1 text-[11px] transition ${
                            extractedParams.target_duration === d
                              ? "border-mint/40 bg-mint/10 text-mint"
                              : "border-line text-gray-500 hover:text-gray-200"
                          }`}
                          onClick={() => updateParam("target_duration", d)}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {creating ? (
                <div className="flex items-center justify-center gap-3 py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                  <p className="text-sm text-mint">正在创建...</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <ActionButton
                    icon={IconArrowLeft}
                    label="返回修改"
                    onClick={() => setExtractedParams(null)}
                  />
                  <div className="ml-auto">
                    <ActionButton
                      icon={IconCheck}
                      label="确认创建"
                      onClick={handleCreate}
                      variant="primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
