"use client";

import { useState, useEffect, useRef } from "react";
import type { Section, EisenhowerQuadrant, TimeBlock } from "@/lib/types";
import {
  EISENHOWER_QUADRANTS,
  EISENHOWER_LABELS,
  EISENHOWER_COLORS,
  TIME_BLOCKS,
  TIME_BLOCK_LABELS,
  TIME_BLOCK_COLORS,
} from "@/lib/types";

export default function AddTaskForm({
  sections,
  onAdd,
  date,
  initialStartTime,
  onResetInitialTime,
}: {
  sections: Section[];
  onAdd: (
    title: string,
    estimatedMinutes: number,
    sectionId: string | null,
    eisenhowerQuadrant: EisenhowerQuadrant | null,
    timeRange: { startedAt: string; completedAt: string; actualMinutes: number } | null,
    timeBlock: TimeBlock | null,
    scheduledStart: string | null,
    scheduledEnd: string | null,
    targetDate: string | null,
    startImmediately?: boolean
  ) => void;
  date: string;
  initialStartTime?: string | null;
  onResetInitialTime?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [estimated, setEstimated] = useState(60);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant | null>(null);
  const [timeBlock, setTimeBlock] = useState<TimeBlock | null>(null);
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [targetDate, setTargetDate] = useState(date);
  const [showTimeRange, setShowTimeRange] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // タイムラインからの時間プリフィル
  useEffect(() => {
    if (initialStartTime) {
      setIsOpen(true);
      setShowTimeRange(true);
      setStartTime(initialStartTime);
      // 予定時間にもセット
      setScheduledStart(initialStartTime);
      // 開始時間 + 見積もり時間から終了時間を自動計算
      const [h, m] = initialStartTime.split(":").map(Number);
      const endMinutes = h * 60 + m + estimated;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const endStr = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
      setEndTime(endStr);
      setScheduledEnd(endStr);
      // フォームにスクロール
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      onResetInitialTime?.();
    }
  }, [initialStartTime, estimated, onResetInitialTime]);

  // 予定開始時間が入力されたら、見積もり時間から予定終了時間を自動計算
  const handleScheduledStartChange = (value: string) => {
    setScheduledStart(value);
    if (value && estimated > 0) {
      const [h, m] = value.split(":").map(Number);
      const endMinutes = h * 60 + m + estimated;
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      setScheduledEnd(
        `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`
      );
    }
  };

  const calcActualMinutes = () => {
    if (!startTime || !endTime) return 0;
    const s = new Date(`${targetDate}T${startTime}`);
    const e = new Date(`${targetDate}T${endTime}`);
    return Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 0);
  };

  const doSubmit = (startImmediately = false) => {
    if (!title.trim()) return;

    let timeRange: { startedAt: string; completedAt: string; actualMinutes: number } | null = null;
    if (showTimeRange && startTime && endTime) {
      timeRange = {
        startedAt: new Date(`${targetDate}T${startTime}`).toISOString(),
        completedAt: new Date(`${targetDate}T${endTime}`).toISOString(),
        actualMinutes: calcActualMinutes(),
      };
    }

    const dateDiffers = targetDate !== date ? targetDate : null;

    onAdd(
      title.trim(), estimated, sectionId, quadrant, timeRange, timeBlock,
      scheduledStart || null, scheduledEnd || null, dateDiffers, startImmediately
    );
    setTitle("");
    setEstimated(60);
    setSectionId(null);
    setQuadrant(null);
    setTimeBlock(null);
    setScheduledStart("");
    setScheduledEnd("");
    setTargetDate(date);
    setShowTimeRange(false);
    setStartTime("");
    setEndTime("");
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit(false);
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
      ref={formRef}
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
            onChange={(e) => {
              const id = e.target.value || null;
              setSectionId(id);
              if (id) {
                const sec = sections.find((s) => s.id === id);
                if (sec) {
                  if (!title.trim()) setTitle(sec.name);
                  setEstimated(sec.default_estimated_minutes ?? 60);
                }
              }
            }}
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
      {/* 予定日時 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-400">
          予定日時
        </label>
        <div className="flex items-center gap-2">
          <div className="w-[140px]">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:border-green-accent focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <input
              type="time"
              value={scheduledStart}
              onChange={(e) => handleScheduledStartChange(e.target.value)}
              className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:border-green-accent focus:outline-none"
            />
          </div>
          <span className="text-gray-500">〜</span>
          <div className="flex-1">
            <input
              type="time"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:border-green-accent focus:outline-none"
            />
          </div>
        </div>
        {targetDate !== date && (
          <p className="mt-1 text-xs text-yellow-400">
            ※ {new Date(targetDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })} に追加されます
          </p>
        )}
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
          onClick={() => doSubmit(true)}
          className="rounded-lg border border-green-accent bg-green-accent/10 px-4 py-2 text-sm font-semibold text-green-accent transition hover:bg-green-accent/20"
        >
          追加して開始
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
