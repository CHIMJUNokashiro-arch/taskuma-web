"use client";

import { useState, useEffect } from "react";
import type { DailyTask } from "@/lib/types";

export default function EndTimeBar({ tasks }: { tasks: DailyTask[] }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const remainingMinutes = tasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  const totalMinutes = tasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 0),
    0
  );

  const doneMinutes = tasks
    .filter((t) => t.status === "done")
    .reduce((sum, t) => sum + (t.actual_minutes ?? t.estimated_minutes ?? 0), 0);

  // 実行中タスク（複数可）の経過分を合算
  const inProgressElapsed = tasks
    .filter((t) => t.status === "in_progress" && t.started_at)
    .reduce((sum, t) => {
      return sum + Math.round(
        (now.getTime() - new Date(t.started_at!).getTime()) / 60000
      );
    }, 0);

  const endTime = new Date(now.getTime() + remainingMinutes * 60000);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}時間${m}分` : `${m}分`;
  };

  const progress =
    totalMinutes > 0
      ? Math.min(((doneMinutes + inProgressElapsed) / totalMinutes) * 100, 100)
      : 0;

  return (
    <div className="mb-6 rounded-xl bg-navy-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-gray-400">終了予定</div>
        <div className="text-2xl font-bold text-green-accent">
          {formatTime(endTime)}
        </div>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-navy-700">
        <div
          className="h-full rounded-full bg-green-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>残り {formatDuration(remainingMinutes)}</span>
        <span>合計 {formatDuration(totalMinutes)}</span>
      </div>
    </div>
  );
}
