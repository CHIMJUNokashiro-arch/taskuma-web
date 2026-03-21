"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DailyTask } from "@/lib/types";
import LogTabNav from "./LogTabNav";

type TemplateInfo = { id: string; title: string; is_routine: boolean };

type Props = {
  tasks: DailyTask[];
  templates: TemplateInfo[];
  view: "weekly" | "monthly" | "yearly";
  fromDate: string;
  toDate: string;
  currentDate: string;
};

export default function LogAnalyticsView({
  tasks,
  templates,
  view,
  fromDate,
  toDate,
  currentDate,
}: Props) {
  const router = useRouter();

  // タスクをグループ化して分析
  const analytics = useMemo(() => {
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const groups = new Map<
      string,
      {
        taskName: string;
        isRoutine: boolean;
        completionCount: number;
        totalCount: number;
        totalMinutes: number;
        completionDates: string[];
      }
    >();

    tasks.forEach((task) => {
      const key = task.template_id ?? `title:${task.title}`;
      if (!groups.has(key)) {
        const template = task.template_id
          ? templateMap.get(task.template_id)
          : null;
        groups.set(key, {
          taskName: task.title,
          isRoutine: template?.is_routine ?? false,
          completionCount: 0,
          totalCount: 0,
          totalMinutes: 0,
          completionDates: [],
        });
      }
      const group = groups.get(key)!;
      group.totalCount += 1;
      if (task.status === "done") {
        group.completionCount += 1;
        group.completionDates.push(task.date);
      }
      group.totalMinutes += task.actual_minutes ?? task.estimated_minutes ?? 0;
    });

    return Array.from(groups.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes
    );
  }, [tasks, templates]);

  // サマリー統計
  const summary = useMemo(() => {
    const uniqueDates = new Set(tasks.map((t) => t.date));
    const completed = tasks.filter((t) => t.status === "done").length;
    const totalMinutes = tasks.reduce(
      (sum, t) => sum + (t.actual_minutes ?? 0),
      0
    );
    return {
      days: uniqueDates.size,
      completed,
      total: tasks.length,
      rate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      hours: Math.round(totalMinutes / 60),
    };
  }, [tasks]);

  // 期間ラベル
  const periodLabel = useMemo(() => {
    if (view === "weekly") {
      const from = new Date(fromDate + "T00:00:00");
      const to = new Date(toDate + "T00:00:00");
      const fmtFrom = from.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
      const fmtTo = to.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
      return `${fmtFrom} 〜 ${fmtTo}`;
    }
    if (view === "monthly") {
      const d = new Date(currentDate + "T00:00:00");
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
    const d = new Date(currentDate + "T00:00:00");
    return `${d.getFullYear()}年`;
  }, [view, fromDate, toDate, currentDate]);

  // 期間ナビゲーション
  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const navigatePeriod = useCallback(
    (offset: number) => {
      const d = new Date(currentDate + "T00:00:00");
      if (view === "weekly") d.setDate(d.getDate() + offset * 7);
      else if (view === "monthly") d.setMonth(d.getMonth() + offset);
      else d.setFullYear(d.getFullYear() + offset);
      router.push(`/log?view=${view}&date=${formatDate(d)}`);
    },
    [currentDate, view, router]
  );

  // 時間フォーマット
  const formatMinutes = (min: number) => {
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return `${min}m`;
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h2 className="mb-6 text-xl font-bold text-white">ログ・履歴</h2>

      <LogTabNav activeTab={view} />

      {/* サマリー */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {summary.days}
          </div>
          <div className="text-xs text-gray-500">記録日数</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {summary.completed}
          </div>
          <div className="text-xs text-gray-500">完了タスク</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {summary.rate}%
          </div>
          <div className="text-xs text-gray-500">完了率</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {summary.hours}h
          </div>
          <div className="text-xs text-gray-500">総作業時間</div>
        </div>
      </div>

      {/* 期間ナビゲーション */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <button
          onClick={() => navigatePeriod(-1)}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-navy-700 hover:text-white"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="text-lg font-semibold text-white">{periodLabel}</span>
        <button
          onClick={() => navigatePeriod(1)}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-navy-700 hover:text-white"
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* タスク分析テーブル */}
      <div className="rounded-xl bg-navy-800 p-4">
        <h3 className="mb-3 font-semibold text-white">
          タスク別分析
          <span className="ml-2 text-sm font-normal text-gray-500">
            {analytics.length}件
          </span>
        </h3>

        {analytics.length === 0 ? (
          <p className="text-sm text-gray-500">
            この期間のタスク記録はありません
          </p>
        ) : (
          <div className="space-y-2">
            {/* ヘッダー（PC表示） */}
            <div className="hidden items-center gap-4 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 sm:flex">
              <div className="min-w-0 flex-1">タスク名</div>
              <div className="w-16 text-center">回数</div>
              <div className="w-20 text-center">合計</div>
              <div className="w-20 text-center">平均</div>
            </div>

            {analytics.map((item, i) => {
              // 完了日の重複カウント（同日に複数回完了した場合）
              const dateCounts = new Map<string, number>();
              item.completionDates.forEach((d) => {
                dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1);
              });

              return (
              <div
                key={i}
                className="rounded-lg border border-navy-600 p-3"
              >
                {/* PC表示 */}
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-white">
                      {item.taskName}
                    </span>
                    {item.isRoutine && (
                      <span className="shrink-0 rounded-full bg-green-accent/10 px-2 py-0.5 text-[10px] font-medium text-green-accent">
                        ルーティン
                      </span>
                    )}
                  </div>
                  <div className="w-16 text-center text-sm text-gray-300">
                    {item.completionCount}
                    <span className="text-gray-500">/{item.totalCount}</span>
                  </div>
                  <div className="w-20 text-center text-sm font-medium text-white">
                    {formatMinutes(item.totalMinutes)}
                  </div>
                  <div className="w-20 text-center text-sm text-gray-400">
                    {item.completionCount > 0
                      ? formatMinutes(
                          Math.round(
                            item.totalMinutes / item.completionCount
                          )
                        )
                      : "-"}
                  </div>
                </div>

                {/* 完了日の内訳（PC・複数回完了時） */}
                {item.completionCount > 1 && (
                  <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex sm:pl-0">
                    {Array.from(dateCounts.entries())
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([d, count]) => {
                        const dt = new Date(d + "T00:00:00");
                        const label = dt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
                        return (
                          <span key={d} className="rounded bg-navy-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                            {label}{count > 1 ? ` ×${count}` : ""} ✓
                          </span>
                        );
                      })}
                  </div>
                )}

                {/* モバイル表示 */}
                <div className="sm:hidden">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-medium text-white">
                      {item.taskName}
                    </span>
                    {item.isRoutine && (
                      <span className="shrink-0 rounded-full bg-green-accent/10 px-2 py-0.5 text-[10px] font-medium text-green-accent">
                        ルーティン
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>
                      {item.completionCount}/{item.totalCount}回
                    </span>
                    <span>計 {formatMinutes(item.totalMinutes)}</span>
                    <span>
                      avg{" "}
                      {item.completionCount > 0
                        ? formatMinutes(
                            Math.round(
                              item.totalMinutes / item.completionCount
                            )
                          )
                        : "-"}
                    </span>
                  </div>
                  {/* 完了日の内訳（モバイル・複数回完了時） */}
                  {item.completionCount > 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Array.from(dateCounts.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([d, count]) => {
                          const dt = new Date(d + "T00:00:00");
                          const label = dt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
                          return (
                            <span key={d} className="rounded bg-navy-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                              {label}{count > 1 ? ` ×${count}` : ""} ✓
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
