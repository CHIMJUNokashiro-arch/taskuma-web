"use client";

import { useState, useEffect } from "react";
import type { DailyTask } from "@/lib/types";

export default function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
}: {
  task: DailyTask;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

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
              <span className="text-green-accent">&#10003;</span>
            )}
            <h3
              className={`font-medium ${task.status === "done" ? "text-gray-500 line-through" : "text-white"}`}
            >
              {task.title}
            </h3>
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
