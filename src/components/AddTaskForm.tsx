"use client";

import { useState } from "react";
import type { Section } from "@/lib/types";

export default function AddTaskForm({
  sections,
  onAdd,
}: {
  sections: Section[];
  onAdd: (title: string, estimatedMinutes: number, sectionId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [estimated, setEstimated] = useState(30);
  const [sectionId, setSectionId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), estimated, sectionId);
    setTitle("");
    setEstimated(30);
    setSectionId(null);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-600 py-4 text-sm text-gray-500 transition hover:border-green-accent hover:text-green-accent"
      >
        <span className="text-lg">+</span>
        タスクを追加
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-xl border border-navy-600 bg-navy-800 p-4"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タスク名"
        autoFocus
        className="mb-3 w-full rounded-lg border border-navy-600 bg-navy-900 px-4 py-2 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
      />
      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-400">
            見積もり（分）
          </label>
          <input
            type="number"
            value={estimated}
            onChange={(e) => setEstimated(Number(e.target.value))}
            min={1}
            className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-white focus:border-green-accent focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-400">
            セクション
          </label>
          <select
            value={sectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value || null)}
            className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-white focus:border-green-accent focus:outline-none"
          >
            <option value="">未分類</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
        >
          追加
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg border border-navy-600 px-4 py-2 text-sm text-gray-400 transition hover:bg-navy-700"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
