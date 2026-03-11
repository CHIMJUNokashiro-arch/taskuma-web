"use client";

import { useState, useEffect, useMemo } from "react";
import type { DailyTask } from "@/lib/types";
import { EISENHOWER_COLORS } from "@/lib/types";

const TIMELINE_START = 6; // 6:00
const TIMELINE_END = 24; // 24:00
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

export default function TimelineView({ tasks }: { tasks: DailyTask[] }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const blocks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "done" || t.status === "in_progress")
      .map((task) => {
        let startTime: Date;
        let endTime: Date;

        if (task.status === "done" && task.completed_at) {
          endTime = new Date(task.completed_at);
          const durationMs = (task.actual_minutes ?? task.estimated_minutes ?? 30) * 60000;
          startTime = new Date(endTime.getTime() - durationMs);
        } else if (task.status === "in_progress" && task.started_at) {
          startTime = new Date(task.started_at);
          endTime = now;
        } else {
          return null;
        }

        const startHour =
          startTime.getHours() + startTime.getMinutes() / 60;
        const endHour = endTime.getHours() + endTime.getMinutes() / 60;

        const left = Math.max(
          ((startHour - TIMELINE_START) / TOTAL_HOURS) * 100,
          0
        );
        const right = Math.min(
          ((endHour - TIMELINE_START) / TOTAL_HOURS) * 100,
          100
        );
        const width = Math.max(right - left, 0.5); // minimum width

        return {
          id: task.id,
          title: task.title,
          left,
          width,
          quadrant: task.eisenhower_quadrant,
          status: task.status,
        };
      })
      .filter(Boolean);
  }, [tasks, now]);

  // タイムラインに表示するタスクがなければ非表示
  if (blocks.length === 0) return null;

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowPosition = ((nowHour - TIMELINE_START) / TOTAL_HOURS) * 100;
  const showNowLine = nowPosition >= 0 && nowPosition <= 100;

  // 時間マーカー
  const hourMarkers = [];
  for (let h = TIMELINE_START; h <= TIMELINE_END; h += 3) {
    hourMarkers.push(h);
  }

  return (
    <div className="mb-6 rounded-xl bg-navy-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">
        タイムライン
      </h3>

      {/* 時間マーカー */}
      <div className="relative mb-1 h-4">
        {hourMarkers.map((h) => {
          const pos = ((h - TIMELINE_START) / TOTAL_HOURS) * 100;
          return (
            <span
              key={h}
              className="absolute text-[10px] text-gray-500"
              style={{
                left: `${pos}%`,
                transform: "translateX(-50%)",
              }}
            >
              {h}:00
            </span>
          );
        })}
      </div>

      {/* タイムラインバー */}
      <div className="relative h-8 rounded-lg bg-navy-900">
        {/* タスクブロック */}
        {blocks.map((block) => {
          if (!block) return null;

          const colorClass = block.quadrant
            ? EISENHOWER_COLORS[block.quadrant].text
                .replace("text-", "bg-")
                .replace("-400", "-500")
            : block.status === "in_progress"
              ? "bg-green-500"
              : "bg-gray-500";

          return (
            <div
              key={block.id}
              className={`group absolute top-1 h-6 rounded ${colorClass} cursor-default opacity-80 transition hover:opacity-100`}
              style={{
                left: `${block.left}%`,
                width: `${block.width}%`,
                minWidth: "4px",
              }}
              title={block.title}
            >
              {/* ホバー時のツールチップ */}
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy-700 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                {block.title}
              </div>
            </div>
          );
        })}

        {/* 現在時刻インジケーター */}
        {showNowLine && (
          <div
            className="absolute top-0 h-full w-0.5 bg-green-accent"
            style={{ left: `${nowPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-green-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
