"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api, ChatResponse } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ChatResponse["trades"];
  watchlistChanges?: ChatResponse["watchlist_changes"];
}

interface ChatPanelProps {
  onDataRefresh?: () => void;
}

export default function ChatPanel({ onDataRefresh }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await api.chat(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          actions: res.trades,
          watchlistChanges: res.watchlist_changes,
        },
      ]);
      if (res.trades?.length || res.watchlist_changes?.length) {
        onDataRefresh?.();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: failed to get response." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-8 shrink-0 items-center justify-center border-l border-border bg-bg-panel text-text-secondary transition-colors hover:text-text-primary"
        aria-label="Expand chat"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          AI Chat
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="text-text-secondary transition-colors hover:text-text-primary"
          aria-label="Collapse chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-center text-sm text-text-secondary">
            Ask about stocks, trade, or manage your watchlist.
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && <LoadingDots />}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message..."
          disabled={loading}
          className="min-w-0 flex-1 rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-accent-purple px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : ""}>
      <div
        className={`max-w-[90%] rounded px-3 py-2 text-sm ${
          isUser
            ? "bg-accent-purple/20 text-text-primary"
            : "bg-bg-secondary text-text-primary"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.actions.map((t, i) => (
              <ActionBadge
                key={i}
                text={`${t.side === "buy" ? "Bought" : "Sold"} ${t.quantity} ${t.ticker}`}
                variant={t.side === "buy" ? "green" : "red"}
              />
            ))}
          </div>
        )}

        {message.watchlistChanges && message.watchlistChanges.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.watchlistChanges.map((w, i) => (
              <ActionBadge
                key={i}
                text={`${w.action === "add" ? "Added" : "Removed"} ${w.ticker} ${w.action === "add" ? "to" : "from"} watchlist`}
                variant="blue"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBadge({ text, variant }: { text: string; variant: "green" | "red" | "blue" }) {
  const colors = {
    green: "bg-green/15 text-green border-green/30",
    red: "bg-red/15 text-red border-red/30",
    blue: "bg-accent-blue/15 text-accent-blue border-accent-blue/30",
  };

  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {text}
    </span>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1 px-3 py-2">
      <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary [animation-delay:300ms]" />
    </div>
  );
}
