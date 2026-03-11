"use client";

import { useState } from "react";
import type { Section, EisenhowerQuadrant } from "@/lib/types";
import {
  EISENHOWER_QUADRANTS,
  EISENHOWER_LABELS,
  EISENHOWER_COLORS,
} from "@/lib/types";

export default function AddTaskForm({
  sections,
  onAdd,
  date,
}: {
  sections: Section[];
  onAdd: (
    title: string,
    estimatedMinutes: number,
    sectionId: string | null,
    eisenhowerQuadrant: EisenhowerQuadrant | null,
    timeRange: { startedAt: string; completedAt: string; actualMinutes: number } | null
  ) => void;
  date: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [estimated, setEstimated] = useState(30);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant | null>(null);
  const [showTimeRange, setShowTimeRange] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const calcActualMinutes = () => {
    if (!startTime || !endTime) return 0;
    const s = new Date(`${date}T${startTime}`);
    const e = new Date(`${date}T${endTime}`);
    return Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let timeRange: { startedAt: string; completedAt: string; actualMinutes: number } | null = null;
    if (showTimeRange && startTime && endTime) {
      timeRange = {
        startedAt: new Date(`${date}T${startTime}`).toISOString(),
        completedAt: new Date(`${date}T${endTime}`).toISOString(),
        actualMinutes: calcActualMinutes(),
      };
    }

    onAdd(title.trim(), estimated, sectionId, quadrant, timeRange);
    setTitle("");
    setEstimated(30);
    setSectionId(null);
    setQuadrant(null);
    setShowTimeRange(false);
    setStartTime("");
    setEndTime("");
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
      {/* アイゼンハワー象限セレクター */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-400">
          重要度・緊急度
        </label>
        <div className="flex flex-wrap gap-1.5">
          {EISENHOWER_QUADRANTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuadrant(quadrant === q ? null : q)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                quadrant === q
                  ? `${EISENHOWER_COLORS[q].bg} ${EISENHOWER_COLORS[q].text} ${EISENHOWER_COLORS[q].border} border`
                  : "border border-navy-600 text-gray-500 hover:border-navy-400"
              }`}
            >
              {EISENHOWER_LABELS[q]}
            </button>
          ))}
        </div>
      </div>
      {/* 時間指定（後から記録用） */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowTimeRange(!showTimeRange)}
          className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-300"
        >
          <span className={`transition ${showTimeRange ? "rotate-90" : ""}`}>&#9654;</span>
          実施時間を記録（後から追加用）
        </button>
        {showTimeRange && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-gray-500">開始</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            <span className="mt-4 text-gray-500">-</span>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-gray-500">終了</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            {startTime && endTime && (
              <span className="mt-4 text-xs text-green-accent">
                {calcActualMinutes()}分
              </span>
            )}
          </div>
        )}
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
