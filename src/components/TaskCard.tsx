"use client";

import { useState, useEffect, useRef } from "react";
import type { DailyTask, Section, TimeBlock } from "@/lib/types";
import {
  EISENHOWER_LABELS,
  EISENHOWER_COLORS,
  TIME_BLOCKS,
  TIME_BLOCK_LABELS,
  TIME_BLOCK_COLORS,
} from "@/lib/types";

export default function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
  onUpdate,
  onAddToRoutine,
  onRevert,
  sections,
}: {
  task: DailyTask;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<DailyTask>) => void;
  onAddToRoutine?: (task: DailyTask) => void;
  onRevert?: (id: string) => void;
  sections?: Section[];
}) {
  const [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEstimated, setEditEstimated] = useState(task.estimated_minutes);
  const [editTimeBlock, setEditTimeBlock] = useState<TimeBlock | null>(task.time_block);
  const [editEndTime, setEditEndTime] = useState("");
  const [editSectionId, setEditSectionId] = useState<string | null>(task.section_id);
  const [editScheduledStart, setEditScheduledStart] = useState(task.scheduled_start || "");
  const [editScheduledEnd, setEditScheduledEnd] = useState(task.scheduled_end || "");
  const [editDate, setEditDate] = useState(task.date);
  const [editEndDate, setEditEndDate] = useState(() => {
    if (task.completed_at) {
      return task.completed_at.split("T")[0];
    }
    return task.date;
  });
  const composingRef = useRef(false);

  useEffect(() => {
    if (task.status !== "in_progress" || !task.started_at) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const diff = Math.round(
        (Date.now() - new Date(task.started_at!).getTime()) / 1000
      );
      setElapsed(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [task.status, task.started_at]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalActual = (task.actual_minutes ?? 0) + Math.floor(elapsed / 60);

  const statusStyles = {
    pending: "border-navy-600 bg-navy-800",
    in_progress: "border-green-accent/50 bg-navy-800 ring-1 ring-green-accent/20",
    done: "border-navy-700 bg-navy-900 opacity-60",
  };

  const startEditing = () => {
    if (!onUpdate) return;
    setEditTitle(task.title);
    setEditEstimated(task.estimated_minutes);
    // started_at → HH:mm形式に変換
    if (task.started_at) {
      const d = new Date(task.started_at);
      setEditStartTime(
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
      );
    } else {
      setEditStartTime("");
    }
    if (task.completed_at) {
      const d = new Date(task.completed_at);
      setEditEndTime(
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
      );
    } else {
      setEditEndTime("");
    }
    setEditTimeBlock(task.time_block);
    setEditSectionId(task.section_id);
    setEditScheduledStart(task.scheduled_start || "");
    setEditScheduledEnd(task.scheduled_end || "");
    setEditDate(task.date);
    setEditEndDate(task.completed_at ? task.completed_at.split("T")[0] : task.date);
    setEditing(true);
  };

  const handleSave = () => {
    if (!onUpdate) return;
    const updates: Partial<DailyTask> = {};

    if (editTitle.trim() && editTitle.trim() !== task.title) {
      updates.title = editTitle.trim();
    }
    if (editEstimated !== task.estimated_minutes) {
      updates.estimated_minutes = editEstimated;
    }

    // 日付変更
    if (editDate && editDate !== task.date) {
      updates.date = editDate;
    }

    // Build base date from editDate for creating new timestamps
    const baseDate = editDate ? new Date(editDate + "T00:00:00") : new Date();

    // Handle start time
    if (editStartTime) {
      const [h, m] = editStartTime.split(":").map(Number);
      const newStart = new Date(baseDate);
      newStart.setHours(h, m, 0, 0);
      const origStart = task.started_at ? new Date(task.started_at) : null;
      if (!origStart || newStart.toISOString() !== origStart.toISOString()) {
        updates.started_at = newStart.toISOString();
      }
    }

    // Handle end time (with separate end date for overnight tasks)
    if (editEndTime) {
      const [h, m] = editEndTime.split(":").map(Number);
      const endDateBase = new Date((editEndDate || editDate) + "T00:00:00");
      const newEnd = new Date(endDateBase);
      newEnd.setHours(h, m, 0, 0);

      const origEnd = task.completed_at ? new Date(task.completed_at) : null;
      if (!origEnd || newEnd.toISOString() !== origEnd.toISOString()) {
        updates.completed_at = newEnd.toISOString();
        // Recalculate actual_minutes from start to new end
        const startRef = updates.started_at
          ? new Date(updates.started_at)
          : task.started_at
          ? new Date(task.started_at)
          : null;
        if (startRef) {
          updates.actual_minutes = Math.max(0, Math.round((newEnd.getTime() - startRef.getTime()) / 60000));
        }
      }
    }

    if (editTimeBlock !== task.time_block) {
      updates.time_block = editTimeBlock;
    }

    if (editSectionId !== task.section_id) {
      updates.section_id = editSectionId;
    }

    if ((editScheduledStart || null) !== (task.scheduled_start || null)) {
      updates.scheduled_start = editScheduledStart || null;
    }
    if ((editScheduledEnd || null) !== (task.scheduled_end || null)) {
      updates.scheduled_end = editScheduledEnd || null;
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(task.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  // 編集モード
  if (editing) {
    return (
      <div className={`rounded-xl border p-4 transition ${statusStyles[task.status]}`}>
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-white focus:border-green-accent focus:outline-none"
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={(e) => {
              if (composingRef.current || e.nativeEvent.isComposing) return;
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-500">見積(分)</label>
              <input
                type="number"
                value={editEstimated}
                onChange={(e) => setEditEstimated(Number(e.target.value))}
                min={1}
                className="w-16 rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-500">開始</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                placeholder="--:--"
                className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            {(task.status === "done" || task.completed_at) && (
              <>
                <label className="text-[10px] text-gray-500">終了</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-[110px] rounded-lg border border-navy-600 bg-navy-900 px-1.5 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
                />
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  placeholder="--:--"
                  className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
                />
              </>
            )}
          </div>
          {sections && sections.length > 0 && (
            <div>
              <label className="mb-1 block text-[10px] text-gray-500">セクション</label>
              <select
                value={editSectionId ?? ""}
                onChange={(e) => setEditSectionId(e.target.value || null)}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              >
                <option value="">未分類</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] text-gray-500">日付・予定時間</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-[120px] rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              />
              <input
                type="time"
                value={editScheduledStart}
                onChange={(e) => {
                  setEditScheduledStart(e.target.value);
                  // 予定開始変更時に見積もりから終了時間を自動計算（終了未設定の場合）
                  if (e.target.value && !editScheduledEnd && editEstimated > 0) {
                    const [h, m] = e.target.value.split(":").map(Number);
                    const endMin = h * 60 + m + editEstimated;
                    const eH = Math.floor(endMin / 60) % 24;
                    const eM = endMin % 60;
                    setEditScheduledEnd(`${eH.toString().padStart(2, "0")}:${eM.toString().padStart(2, "0")}`);
                  }
                }}
                className="w-24 rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">〜</span>
              <input
                type="time"
                value={editScheduledEnd}
                onChange={(e) => setEditScheduledEnd(e.target.value)}
                className="w-24 rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            {editDate !== task.date && (
              <p className="mt-1 text-[10px] text-yellow-400">
                ※ {new Date(editDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })} に移動します
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-green-accent px-3 py-1 text-xs font-semibold text-navy-950 transition hover:bg-green-accent-dark"
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-navy-600 px-3 py-1 text-xs text-gray-400 transition hover:bg-navy-700"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 transition ${statusStyles[task.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {task.status === "in_progress" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-accent opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-accent" />
              </span>
            )}
            {task.status === "done" && (
              onRevert ? (
                <button
                  onClick={() => onRevert(task.id)}
                  className="text-green-accent transition hover:text-yellow-400"
                  title="未完了に戻す"
                >
                  &#10003;
                </button>
              ) : (
                <span className="text-green-accent">&#10003;</span>
              )
            )}
            <h3
              className={`font-medium ${task.status === "done" ? "text-gray-500 line-through" : "text-white"} ${onUpdate ? "cursor-pointer hover:text-green-accent" : ""}`}
              onClick={onUpdate ? startEditing : undefined}
              title={onUpdate ? "クリックで編集" : undefined}
            >
              {task.title}
            </h3>
            {task.eisenhower_quadrant && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EISENHOWER_COLORS[task.eisenhower_quadrant].badge}`}
              >
                {EISENHOWER_LABELS[task.eisenhower_quadrant]}
              </span>
            )}
            {task.scheduled_start && (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                {task.scheduled_start}{task.scheduled_end ? `–${task.scheduled_end}` : ""}
              </span>
            )}
            {!task.scheduled_start && task.time_block && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TIME_BLOCK_COLORS[task.time_block].badge}`}
              >
                {TIME_BLOCK_LABELS[task.time_block]}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>見積: {task.estimated_minutes}分</span>
            {task.status === "done" && task.actual_minutes != null && (
              <span>
                実績: {task.actual_minutes}分
                {task.actual_minutes > task.estimated_minutes && (
                  <span className="ml-1 text-red-400">
                    (+{task.actual_minutes - task.estimated_minutes}分)
                  </span>
                )}
              </span>
            )}
            {task.status === "in_progress" && (
              <span className="font-mono text-green-accent">
                {formatTimer(elapsed)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {task.status === "pending" && (
            <button
              onClick={() => onStart(task.id)}
              className="rounded-lg bg-green-accent/10 px-3 py-1.5 text-xs font-medium text-green-accent transition hover:bg-green-accent/20"
            >
              開始
            </button>
          )}
          {task.status === "in_progress" && (
            <button
              onClick={() => onComplete(task.id)}
              className="rounded-lg bg-green-accent px-3 py-1.5 text-xs font-medium text-navy-950 transition hover:bg-green-accent-dark"
            >
              完了
            </button>
          )}
          {onAddToRoutine && (
            <button
              onClick={() => onAddToRoutine(task)}
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-navy-700 hover:text-green-accent"
              title="ルーティンに追加"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {task.status !== "in_progress" && (
            <button
              onClick={() => onDelete(task.id)}
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-navy-700 hover:text-red-400"
              title="削除"
            >
              <svg
                className="h-4 w-4"
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
          )}
        </div>
      </div>

      {/* Progress bar for in_progress */}
      {task.status === "in_progress" && task.estimated_minutes > 0 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-navy-700">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              totalActual > task.estimated_minutes
                ? "bg-red-400"
                : "bg-green-accent"
            }`}
            style={{
              width: `${Math.min((totalActual / task.estimated_minutes) * 100, 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
