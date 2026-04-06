"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PeriodicGoal, PeriodType } from "@/lib/types";

function getWeekRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); // 0=日
  const diff = day === 0 ? -6 : 1 - day; // 月曜始まり
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { start: fmt(mon), end: fmt(sun) };
}

function getMonthRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { start, end };
}

export default function PeriodicGoals({
  initialWeeklyGoals,
  initialMonthlyGoals,
  date,
}: {
  initialWeeklyGoals: PeriodicGoal[];
  initialMonthlyGoals: PeriodicGoal[];
  date: string;
}) {
  const [weeklyGoals, setWeeklyGoals] = useState<PeriodicGoal[]>(initialWeeklyGoals);
  const [monthlyGoals, setMonthlyGoals] = useState<PeriodicGoal[]>(initialMonthlyGoals);
  const [addingType, setAddingType] = useState<PeriodType | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetCount, setNewTargetCount] = useState<number>(1);
  const [weeklyCollapsed, setWeeklyCollapsed] = useState(false);
  const [monthlyCollapsed, setMonthlyCollapsed] = useState(false);
  const composingRef = useRef(false);
  const supabase = createClient();

  const weekRange = getWeekRange(date);
  const monthRange = getMonthRange(date);

  const handleAdd = useCallback(
    async (periodType: PeriodType) => {
      if (!newTitle.trim()) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const range = periodType === "weekly" ? weekRange : monthRange;
      const goals = periodType === "weekly" ? weeklyGoals : monthlyGoals;
      const maxSort = goals.reduce((max, g) => Math.max(max, g.sort_order ?? 0), 0);

      const { data } = await supabase
        .from("periodic_goals")
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          period_type: periodType,
          period_start: range.start,
          period_end: range.end,
          target_count: newTargetCount > 1 ? newTargetCount : null,
          current_count: 0,
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (data) {
        if (periodType === "weekly") {
          setWeeklyGoals((prev) => [...prev, data]);
        } else {
          setMonthlyGoals((prev) => [...prev, data]);
        }
        setNewTitle("");
        setNewTargetCount(1);
        setAddingType(null);
      }
    },
    [newTitle, supabase, weekRange, monthRange, weeklyGoals, monthlyGoals]
  );

  const handleToggle = useCallback(
    async (goal: PeriodicGoal) => {
      const setter = goal.period_type === "weekly" ? setWeeklyGoals : setMonthlyGoals;
      const tc = goal.target_count ?? 1;
      const cc = goal.current_count ?? 0;

      if (goal.status === "done") {
        // 完了 → 未完了に戻す（回数もリセット）
        setter((prev) =>
          prev.map((g) =>
            g.id === goal.id ? { ...g, status: "pending", completed_at: null, current_count: Math.max(0, cc - 1) } : g
          )
        );
        await supabase
          .from("periodic_goals")
          .update({ status: "pending", completed_at: null, current_count: Math.max(0, cc - 1) })
          .eq("id", goal.id);
      } else {
        // カウントアップ
        const newCount = cc + 1;
        const isDone = newCount >= tc;
        setter((prev) =>
          prev.map((g) =>
            g.id === goal.id
              ? { ...g, current_count: newCount, status: isDone ? "done" : "pending", completed_at: isDone ? new Date().toISOString() : null }
              : g
          )
        );
        await supabase
          .from("periodic_goals")
          .update({
            current_count: newCount,
            status: isDone ? "done" : "pending",
            completed_at: isDone ? new Date().toISOString() : null,
          })
          .eq("id", goal.id);
      }
    },
    [supabase]
  );

  const handleDelete = useCallback(
    async (goal: PeriodicGoal) => {
      const setter = goal.period_type === "weekly" ? setWeeklyGoals : setMonthlyGoals;
      setter((prev) => prev.filter((g) => g.id !== goal.id));
      await supabase.from("periodic_goals").delete().eq("id", goal.id);
    },
    [supabase]
  );

  const weekLabel = (() => {
    const s = new Date(weekRange.start + "T00:00:00");
    const e = new Date(weekRange.end + "T00:00:00");
    return `${s.getMonth() + 1}/${s.getDate()} 〜 ${e.getMonth() + 1}/${e.getDate()}`;
  })();

  const monthLabel = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  })();

  const renderGoalSection = (
    title: string,
    label: string,
    goals: PeriodicGoal[],
    periodType: PeriodType,
    collapsed: boolean,
    setCollapsed: (v: boolean) => void
  ) => {
    const doneCount = goals.filter((g) => g.status === "done").length;
    return (
      <div className="mb-4 rounded-xl border border-navy-600 bg-navy-800/50 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs text-gray-500 transition ${collapsed ? "" : "rotate-90"}`}>&#9654;</span>
            <span className="text-sm font-semibold text-gray-300">{title}</span>
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs text-gray-500">
              {doneCount}/{goals.length}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddingType(addingType === periodType ? null : periodType);
              setNewTitle("");
            }}
            className="rounded-md px-2 py-0.5 text-xs text-gray-500 transition hover:bg-navy-700 hover:text-green-accent"
          >
            + 追加
          </button>
        </button>

        {/* 進捗バー */}
        {goals.length > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
            <div
              className="h-full rounded-full bg-green-accent transition-all duration-300"
              style={{ width: `${goals.length > 0 ? (doneCount / goals.length) * 100 : 0}%` }}
            />
          </div>
        )}

        {!collapsed && (
          <div className="mt-2 space-y-1">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                  goal.status === "done" ? "opacity-70" : ""
                }`}
              >
                <button
                  onClick={() => handleToggle(goal)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    goal.status === "done"
                      ? "border-green-accent bg-green-accent text-navy-950"
                      : (goal.current_count ?? 0) > 0
                        ? "border-green-accent/50 bg-green-accent/10"
                        : "border-navy-500 hover:border-green-accent"
                  }`}
                >
                  {goal.status === "done" ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (goal.current_count ?? 0) > 0 ? (
                    <span className="text-[9px] font-bold text-green-accent">{goal.current_count}</span>
                  ) : null}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    goal.status === "done" ? "text-gray-500 line-through" : "text-white"
                  }`}
                >
                  {goal.title}
                </span>
                {(goal.target_count ?? 0) > 1 && (
                  <span className={`text-[10px] ${goal.status === "done" ? "text-green-accent" : "text-gray-500"}`}>
                    {goal.current_count ?? 0}/{goal.target_count}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(goal)}
                  className="hidden text-gray-600 transition hover:text-red-400 group-hover:block"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* 追加フォーム */}
            {addingType === periodType && (
              <div className="mt-1 space-y-2">
                <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="目標を入力..."
                  autoFocus
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(e) => {
                    if (composingRef.current || e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") handleAdd(periodType);
                    if (e.key === "Escape") { setAddingType(null); setNewTitle(""); setNewTargetCount(1); }
                  }}
                  className="flex-1 rounded-lg border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-accent focus:outline-none"
                />
                <button
                  onClick={() => handleAdd(periodType)}
                  className="rounded-lg bg-green-accent px-3 py-1.5 text-xs font-semibold text-navy-950 hover:bg-green-accent-dark"
                >
                  追加
                </button>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <label className="text-[10px] text-gray-500">目標回数</label>
                  <input
                    type="number"
                    min={1}
                    value={newTargetCount}
                    onChange={(e) => setNewTargetCount(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-xs text-white focus:border-green-accent focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-500">回（1回なら1回チェックで完了）</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      {renderGoalSection("週の目標", weekLabel, weeklyGoals, "weekly", weeklyCollapsed, setWeeklyCollapsed)}
      {renderGoalSection("月の目標", monthLabel, monthlyGoals, "monthly", monthlyCollapsed, setMonthlyCollapsed)}
    </div>
  );
}
