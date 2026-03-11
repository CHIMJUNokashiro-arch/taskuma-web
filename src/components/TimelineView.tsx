"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { DailyTask, EisenhowerQuadrant } from "@/lib/types";

// Tailwindはビルド時に静的スキャンするため、クラス名をリテラルで定義する必要がある
const QUADRANT_BLOCK_COLORS: Record<EisenhowerQuadrant, string> = {
  urgent_important: "bg-red-500",
  important: "bg-blue-500",
  urgent: "bg-yellow-500",
  other: "bg-gray-400",
};

const TIMELINE_START = 6; // 6:00
const TIMELINE_END = 24; // 24:00
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

export default function TimelineView({
  tasks,
  onTimeClick,
}: {
  tasks: DailyTask[];
  onTimeClick?: (startTime: string) => void;
}) {
  const [now, setNow] = useState(new Date());
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const barRef = useRef<HTMLDivElement>(null);

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

  const calcTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!barRef.current) return null;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const totalMinutes = (TIMELINE_START + ratio * TOTAL_HOURS) * 60;
      // 15分単位に丸め
      const roundedMinutes = Math.round(totalMinutes / 15) * 15;
      const h = Math.floor(roundedMinutes / 60);
      const m = roundedMinutes % 60;
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    },
    []
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      const time = calcTimeFromPosition(e.clientX);
      if (time && onTimeClick) {
        onTimeClick(time);
      }
    },
    [calcTimeFromPosition, onTimeClick]
  );

  const handleBarMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const time = calcTimeFromPosition(e.clientX);
      setHoverTime(time);
      setHoverX(e.clientX - rect.left);
    },
    [calcTimeFromPosition]
  );

  const handleBarMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

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
      <div
        ref={barRef}
        className={`relative h-8 rounded-lg bg-navy-900 ${onTimeClick ? "cursor-pointer" : ""}`}
        onClick={onTimeClick ? handleBarClick : undefined}
        onMouseMove={onTimeClick ? handleBarMouseMove : undefined}
        onMouseLeave={onTimeClick ? handleBarMouseLeave : undefined}
      >
        {/* タスクブロック */}
        {blocks.map((block) => {
          if (!block) return null;

          const colorClass = block.quadrant
            ? QUADRANT_BLOCK_COLORS[block.quadrant]
            : block.status === "in_progress"
              ? "bg-green-500"
              : "bg-gray-500";

          return (
            <div
              key={block.id}
              className={`group absolute top-1 h-6 rounded ${colorClass} pointer-events-none opacity-80`}
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
            className="pointer-events-none absolute top-0 h-full w-0.5 bg-green-accent"
            style={{ left: `${nowPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-green-accent" />
          </div>
        )}

        {/* ホバー時の時間表示 + 「+」インジケーター */}
        {onTimeClick && hoverTime && (
          <>
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-green-accent/40"
              style={{ left: `${hoverX}px` }}
            />
            <div
              className="pointer-events-none absolute -top-7 z-20 flex items-center gap-1 rounded bg-green-accent px-2 py-0.5 text-[10px] font-semibold text-navy-950 shadow-lg"
              style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
            >
              <span>+</span>
              <span>{hoverTime}</span>
            </div>
          </>
        )}
      </div>

      {/* クリックヒント */}
      {onTimeClick && (
        <p className="mt-1.5 text-[10px] text-gray-600">
          タイムラインをクリックしてタスクを追加
        </p>
      )}
    </div>
  );
}
