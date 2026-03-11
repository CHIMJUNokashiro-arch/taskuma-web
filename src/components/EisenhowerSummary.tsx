"use client";

import { useMemo } from "react";
import type { DailyTask, EisenhowerQuadrant } from "@/lib/types";
import {
  EISENHOWER_QUADRANTS,
  EISENHOWER_LABELS,
  EISENHOWER_COLORS,
} from "@/lib/types";

export default function EisenhowerSummary({
  tasks,
}: {
  tasks: DailyTask[];
}) {
  const stats = useMemo(() => {
    const result: Record<
      EisenhowerQuadrant,
      { count: number; minutes: number }
    > = {
      urgent_important: { count: 0, minutes: 0 },
      important: { count: 0, minutes: 0 },
      urgent: { count: 0, minutes: 0 },
      other: { count: 0, minutes: 0 },
    };

    let totalMinutes = 0;

    tasks.forEach((task) => {
      if (!task.eisenhower_quadrant) return;
      const minutes =
        task.actual_minutes ?? task.estimated_minutes ?? 0;
      result[task.eisenhower_quadrant].count += 1;
      result[task.eisenhower_quadrant].minutes += minutes;
      totalMinutes += minutes;
    });

    return { quadrants: result, totalMinutes };
  }, [tasks]);

  // 象限が設定されたタスクがなければ表示しない
  const hasAnyQuadrant = tasks.some((t) => t.eisenhower_quadrant);
  if (!hasAnyQuadrant) return null;

  const maxQuadrant = EISENHOWER_QUADRANTS.reduce((max, q) =>
    stats.quadrants[q].minutes > stats.quadrants[max].minutes ? q : max
  );

  return (
    <div className="mb-6 rounded-xl bg-navy-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">
        時間配分マトリクス
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {EISENHOWER_QUADRANTS.map((q) => {
          const { count, minutes } = stats.quadrants[q];
          const pct =
            stats.totalMinutes > 0
              ? Math.round((minutes / stats.totalMinutes) * 100)
              : 0;
          const isHighlight = q === "important" && maxQuadrant === "important";

          return (
            <div
              key={q}
              className={`rounded-lg border p-3 transition ${
                isHighlight
                  ? "border-blue-500/50 bg-blue-500/10"
                  : `${EISENHOWER_COLORS[q].border} ${EISENHOWER_COLORS[q].bg}`
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${EISENHOWER_COLORS[q].text}`}
                >
                  {EISENHOWER_LABELS[q]}
                </span>
                <span className="text-xs text-gray-500">{count}件</span>
              </div>
              <div className="mb-1.5 text-lg font-bold text-white">
                {minutes}
                <span className="ml-0.5 text-xs font-normal text-gray-400">
                  分
                </span>
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHighlight ? "bg-blue-400" : EISENHOWER_COLORS[q].text.replace("text-", "bg-")
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
