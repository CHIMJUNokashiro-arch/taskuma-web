"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChatPanel({
  onSuggestAccept,
}: {
  onSuggestAccept?: (
    tasks: { title: string; estimated_minutes: number; section: string }[]
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/ai/suggest", { method: "POST" });
      const data = await res.json();
      if (data.tasks) {
        const msg = `${data.summary ?? "提案します"}\n\n${data.tasks.map((t: { title: string; estimated_minutes: number; section: string }) => `- ${t.title} (${t.estimated_minutes}分, ${t.section})`).join("\n")}`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg },
        ]);
        if (onSuggestAccept) {
          // 提案をそのまま受け入れ可能に
          onSuggestAccept(data.tasks);
        }
      } else if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `エラー: ${data.error}`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "通信エラーが発生しました" },
      ]);
    }
    setSuggesting(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "通信エラーが発生しました" },
      ]);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-30 rounded-full bg-green-accent p-3 shadow-lg transition hover:bg-green-accent-dark lg:bottom-4"
        title="AIアシスタント"
      >
        <svg
          className="h-6 w-6 text-navy-950"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-30 flex h-[500px] w-full flex-col border-l border-t border-navy-700 bg-navy-900 shadow-2xl sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-96 sm:rounded-xl sm:border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-navy-700 px-4 py-3">
        <h3 className="font-semibold text-white">AIアシスタント</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Suggest Button */}
      <div className="border-b border-navy-700 px-4 py-2">
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          className="w-full rounded-lg bg-green-accent/10 py-2 text-sm font-medium text-green-accent transition hover:bg-green-accent/20 disabled:opacity-50"
        >
          {suggesting ? "分析中..." : "AIに今日のタスクを提案してもらう"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            AIにタスクの相談ができます
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${msg.role === "user" ? "ml-8 text-right" : "mr-8"}`}
          >
            <div
              className={`inline-block rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-green-accent text-navy-950"
                  : "bg-navy-800 text-gray-200"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="mr-8">
            <div className="inline-block rounded-xl bg-navy-800 px-3 py-2 text-sm text-gray-400">
              考え中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-navy-700 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="タスクについて相談..."
            className="flex-1 rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-green-accent px-3 py-2 text-sm font-medium text-navy-950 transition hover:bg-green-accent-dark disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
