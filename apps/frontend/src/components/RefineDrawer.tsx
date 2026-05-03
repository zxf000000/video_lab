"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { streamChat } from "../api";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { IconX, IconSend, IconCheck } from "@tabler/icons-react";

interface RefineDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  currentContent: string;
  onApply: (newContent: string) => void;
  systemPromptKey?: string;
  initialPrompt?: string;
}

export default function RefineDrawer({
  open,
  onClose,
  title,
  currentContent,
  onApply,
  systemPromptKey = "",
  initialPrompt,
}: RefineDrawerProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [initialized, setInitialized] = useState(false);
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
    if (open && !initialized) {
      setInitialized(true);
      const trimmed = currentContent.length > 500
        ? currentContent.slice(0, 500) + "\n...（内容已截断）"
        : currentContent;
      const initialMsg = {
        role: "user",
        content: initialPrompt || `以下是当前${title}内容，请先阅读并等待我的具体修改要求：\n\n${trimmed}`,
      };
      setMessages([initialMsg]);
      sendMessages([initialMsg]);
    }
    if (!open) {
      setInitialized(false);
      setMessages([]);
      setInput("");
      setStreamingContent("");
      setIsStreaming(false);
    }
  }, [open]);

  function sendMessages(msgs: any[]) {
    setIsStreaming(true);
    setStreamingContent("");
    let accumulated = "";

    streamChat(
      msgs,
      (delta: any) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      },
      () => {},
      () => {
        setMessages((prev: any[]) => [
          ...prev,
          { role: "assistant", content: accumulated },
        ]);
        setStreamingContent("");
        setIsStreaming(false);
      },
      (err: any) => {
        toast.error(String(err.message || err));
        setIsStreaming(false);
      },
      systemPromptKey,
    );
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    sendMessages(newMessages);
  }

  function handleKeyDown(e: any) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleApply(content: string) {
    onApply(content);
    onClose();
    toast.success("已应用修改");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o: any) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-lg border-l border-line bg-panel p-0"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">
              AI Refine
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-100">{title}</h2>
          </div>
          <button
            className="shrink-0 rounded-full bg-panel2 px-2.5 py-1 text-xs text-gray-500 transition hover:text-gray-100 disabled:opacity-30"
            onClick={onClose}
            disabled={isStreaming}
          >
            <IconX size={14} stroke={2} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex flex-col gap-3 overflow-y-auto px-5 py-4"
          style={{ height: "calc(100vh - 65px - 60px)" }}
        >
          {messages.slice(1).map((msg: any, i: number) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === "user"
                    ? "bg-mint text-white"
                    : "bg-panel2 text-gray-300"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                {msg.role === "assistant" && (
                  <button
                    className="mt-2 flex items-center gap-1 rounded-lg bg-mint/10 px-2.5 py-1 text-[11px] font-medium text-mint transition hover:bg-mint/20"
                    onClick={() => handleApply(msg.content)}
                  >
                    <IconCheck size={12} stroke={2.5} />
                    应用此内容
                  </button>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl bg-panel2 px-4 py-3 text-sm leading-6 text-gray-300">
                <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
                <span className="inline-block h-4 w-0.5 animate-pulse bg-mint align-middle" />
              </div>
            </div>
          )}

          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-panel2 px-4 py-3">
                <div className="flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-300"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-300"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-300"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-line px-5 py-3">
          <div className="flex gap-2">
            <Textarea
              className="min-h-[44px] flex-1 resize-none rounded-2xl py-2.5 text-sm"
              placeholder="输入修改要求，如：让描述更生动..."
              value={input}
              onChange={(e: any) => setInput(e.target.value)}
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
      </SheetContent>
    </Sheet>
  );
}
