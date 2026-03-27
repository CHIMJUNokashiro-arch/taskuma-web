"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyTask } from "@/lib/types";
import { EISENHOWER_LABELS, EISENHOWER_COLORS } from "@/lib/types";
import EisenhowerSummary from "./EisenhowerSummary";
import LogTabNav from "./LogTabNav";

export default function LogView({ tasks: initialTasks }: { tasks: DailyTask[] }) {
  const [tasks, setTasks] = useState<DailyTask[]>(initialTasks);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEstimated, setEditEstimated] = useState(60);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const composingRef = useRef(false);
  const supabase = createClient();

  const startEdit = (task: DailyTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditEstimated(task.estimated_minutes);
    setEditDate(task.date);
    if (task.started_at) {
      const d = new Date(task.started_at);
      setEditStartTime(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    } else {
      setEditStartTime("");
    }
    if (task.completed_at) {
      const d = new Date(task.completed_at);
      setEditEndDate(task.completed_at.split("T")[0]);
      setEditEndTime(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    } else {
      setEditEndDate(task.date);
      setEditEndTime("");
    }
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingTaskId) return;
    const task = tasks.find((t) => t.id === editingTaskId);
    if (!task) return;

    const updates: Partial<DailyTask> = {};
    if (editTitle.trim() !== task.title) updates.title = editTitle.trim();
    if (editEstimated !== task.estimated_minutes) updates.estimated_minutes = editEstimated;
    if (editDate !== task.date) updates.date = editDate;

    const baseDate = new Date(editDate + "T00:00:00");
    if (editStartTime) {
      const [h, m] = editStartTime.split(":").map(Number);
      const newStart = new Date(baseDate);
      newStart.setHours(h, m, 0, 0);
      const origStart = task.started_at ? new Date(task.started_at) : null;
      if (!origStart || newStart.toISOString() !== origStart.toISOString()) {
        updates.started_at = newStart.toISOString();
      }
    }
    if (editEndTime) {
      const [h, m] = editEndTime.split(":").map(Number);
      const endBase = new Date((editEndDate || editDate) + "T00:00:00");
      const newEnd = new Date(endBase);
      newEnd.setHours(h, m, 0, 0);
      const origEnd = task.completed_at ? new Date(task.completed_at) : null;
      if (!origEnd || newEnd.toISOString() !== origEnd.toISOString()) {
        updates.completed_at = newEnd.toISOString();
        const startRef = updates.started_at ? new Date(updates.started_at) : task.started_at ? new Date(task.started_at) : null;
        if (startRef) {
          updates.actual_minutes = Math.max(0, Math.round((newEnd.getTime() - startRef.getTime()) / 60000));
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? { ...t, ...updates } : t)));
      const dbUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => !["id", "user_id", "created_at"].includes(key))
      );
      const { error } = await supabase.from("daily_tasks").update(dbUpdates).eq("id", editingTaskId);
      if (error) {
        console.error("Failed to update task:", error);
        setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? task : t)));
      }
    }
    setEditingTaskId(null);
  }, [editingTaskId, editTitle, editEstimated, editDate, editStartTime, editEndDate, editEndTime, tasks, supabase]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const prev = tasks.find((t) => t.id === taskId);
    setTasks((p) => p.filter((t) => t.id !== taskId));
    const isRoutine = prev?.template_id != null;
    const { error } = isRoutine
      ? await supabase.from("daily_tasks").update({ dismissed: true }).eq("id", taskId)
      : await supabase.from("daily_tasks").delete().eq("id", taskId);
    if (error && prev) {
      setTasks((p) => [...p, prev]);
    }
    setEditingTaskId(null);
  }, [tasks, supabase]);

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
                {selectedTasks.map((task) =>
                  editingTaskId === task.id ? (
                    <div key={task.id} className="rounded-lg border border-green-accent/50 bg-navy-900 p-3 space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onCompositionStart={() => { composingRef.current = true; }}
                        onCompositionEnd={() => { composingRef.current = false; }}
                        onKeyDown={(e) => {
                          if (composingRef.current || e.nativeEvent.isComposing) return;
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingTaskId(null);
                        }}
                        className="w-full rounded border border-navy-600 bg-navy-800 px-2 py-1 text-sm text-white focus:border-green-accent focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="text-gray-500">見積</label>
                        <input type="number" value={editEstimated} onChange={(e) => setEditEstimated(Number(e.target.value))} min={1}
                          className="w-14 rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 text-white focus:border-green-accent focus:outline-none" />
                        <label className="text-gray-500">分</label>
                        <label className="ml-2 text-gray-500">日付</label>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                          className="rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 text-white focus:border-green-accent focus:outline-none" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="text-gray-500">開始</label>
                        <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)}
                          className="rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 text-white focus:border-green-accent focus:outline-none" />
                        {(task.status === "done" || task.completed_at) && (
                          <>
                            <label className="text-gray-500">終了</label>
                            <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)}
                              className="rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 text-white focus:border-green-accent focus:outline-none" />
                            <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)}
                              className="rounded border border-navy-600 bg-navy-800 px-1.5 py-0.5 text-white focus:border-green-accent focus:outline-none" />
                          </>
                        )}
                      </div>
                      {editDate !== task.date && (
                        <p className="text-[10px] text-yellow-400">
                          ※ {new Date(editDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })} に移動します
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="rounded bg-green-accent px-3 py-1 text-xs font-semibold text-navy-950 hover:bg-green-accent-dark">保存</button>
                        <button onClick={() => setEditingTaskId(null)} className="rounded border border-navy-600 px-3 py-1 text-xs text-gray-400 hover:bg-navy-700">取消</button>
                        <button onClick={() => handleDeleteTask(task.id)} className="ml-auto rounded border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">削除</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={task.id}
                      onClick={() => startEdit(task)}
                      className="flex w-full items-center justify-between rounded-lg border border-navy-600 p-3 text-left transition hover:border-navy-400"
                    >
                      <div className="flex items-center gap-2">
                        <span className={task.status === "done" ? "text-green-accent" : "text-gray-600"}>
                          {task.status === "done" ? "\u2713" : "\u25CB"}
                        </span>
                        <span className={task.status === "done" ? "text-gray-400 line-through" : "text-white"}>
                          {task.title}
                        </span>
                        {task.eisenhower_quadrant && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EISENHOWER_COLORS[task.eisenhower_quadrant].badge}`}>
                            {EISENHOWER_LABELS[task.eisenhower_quadrant]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {task.actual_minutes != null ? `${task.actual_minutes}分` : `${task.estimated_minutes}分`}
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
