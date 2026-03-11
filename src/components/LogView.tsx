"use client";

import { useState, useMemo } from "react";
import type { DailyTask } from "@/lib/types";
import { EISENHOWER_LABELS, EISENHOWER_COLORS } from "@/lib/types";
import EisenhowerSummary from "./EisenhowerSummary";
import LogTabNav from "./LogTabNav";

export default function LogView({ tasks }: { tasks: DailyTask[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 日付ごとにグループ化
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DailyTask[]>();
    tasks.forEach((t) => {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    });
    return map;
  }, [tasks]);

  const dates = useMemo(() => Array.from(tasksByDate.keys()).sort().reverse(), [tasksByDate]);

  // カレンダー用のデータ生成
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const getDateString = (day: number) => {
    const m = String(calMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${calYear}-${m}-${d}`;
  };

  const getDayStats = (day: number) => {
    const dateStr = getDateString(day);
    const dayTasks = tasksByDate.get(dateStr);
    if (!dayTasks) return null;
    const done = dayTasks.filter((t) => t.status === "done").length;
    const total = dayTasks.length;
    const totalMinutes = dayTasks.reduce(
      (sum, t) => sum + (t.actual_minutes ?? t.estimated_minutes ?? 0),
      0
    );
    return { done, total, totalMinutes };
  };

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const selectedTasks = selectedDate ? tasksByDate.get(selectedDate) ?? [] : [];

  // 統計
  const totalDays = dates.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalActualMinutes = tasks.reduce(
    (sum, t) => sum + (t.actual_minutes ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h2 className="mb-6 text-xl font-bold text-white">ログ・履歴</h2>

      <LogTabNav activeTab="daily" />

      {/* 統計サマリー */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">{totalDays}</div>
          <div className="text-xs text-gray-500">記録日数</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {completedTasks}
          </div>
          <div className="text-xs text-gray-500">完了タスク</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0}
            %
          </div>
          <div className="text-xs text-gray-500">完了率</div>
        </div>
        <div className="rounded-xl bg-navy-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-accent">
            {Math.round(totalActualMinutes / 60)}h
          </div>
          <div className="text-xs text-gray-500">総作業時間</div>
        </div>
      </div>

      {/* カレンダー */}
      <div className="mb-6 rounded-xl bg-navy-800 p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded-lg p-2 text-gray-400 hover:bg-navy-700"
          >
            &lt;
          </button>
          <span className="font-semibold text-white">
            {calYear}年{calMonth + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-2 text-gray-400 hover:bg-navy-700"
          >
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
            <div key={d} className="py-1 font-medium text-gray-500">
              {d}
            </div>
          ))}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const stats = getDayStats(day);
            const dateStr = getDateString(day);
            const isSelected = selectedDate === dateStr;
            const isToday =
              dateStr === new Date().toISOString().split("T")[0];

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative rounded-lg p-1.5 text-sm transition ${
                  isSelected
                    ? "bg-green-accent text-navy-950"
                    : isToday
                      ? "bg-navy-600 text-white"
                      : stats
                        ? "text-white hover:bg-navy-700"
                        : "text-gray-600"
                }`}
              >
                {day}
                {stats && !isSelected && (
                  <div className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-green-accent" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日のタスクリスト */}
      {selectedDate && (
        <>
          {/* マトリクス分析（選択日） */}
          <EisenhowerSummary tasks={selectedTasks} />

          <div className="rounded-xl bg-navy-800 p-4">
            <h3 className="mb-3 font-semibold text-white">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </h3>
            {selectedTasks.length === 0 ? (
              <p className="text-sm text-gray-500">この日の記録はありません</p>
            ) : (
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border border-navy-600 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          task.status === "done"
                            ? "text-green-accent"
                            : "text-gray-600"
                        }
                      >
                        {task.status === "done" ? "\u2713" : "\u25CB"}
                      </span>
                      <span
                        className={
                          task.status === "done"
                            ? "text-gray-400 line-through"
                            : "text-white"
                        }
                      >
                        {task.title}
                      </span>
                      {task.eisenhower_quadrant && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EISENHOWER_COLORS[task.eisenhower_quadrant].badge}`}
                        >
                          {EISENHOWER_LABELS[task.eisenhower_quadrant]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {task.actual_minutes != null
                        ? `${task.actual_minutes}分`
                        : `${task.estimated_minutes}分`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
