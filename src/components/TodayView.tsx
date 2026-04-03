"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DailyTask, Section, EisenhowerQuadrant, TimeBlock, PeriodicGoal } from "@/lib/types";
import SortableTaskCard from "./SortableTaskCard";
import TaskCard from "./TaskCard";
import AddTaskForm from "./AddTaskForm";
import EndTimeBar from "./EndTimeBar";
import EisenhowerSummary from "./EisenhowerSummary";
import TimelineView from "./TimelineView";
import AIChatPanel from "./AIChatPanel";
import PeriodicGoals from "./PeriodicGoals";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export default function TodayView({
  initialTasks,
  sections,
  date,
  initialWeeklyGoals = [],
  initialMonthlyGoals = [],
}: {
  initialTasks: DailyTask[];
  sections: Section[];
  date: string;
  initialWeeklyGoals?: PeriodicGoal[];
  initialMonthlyGoals?: PeriodicGoal[];
}) {
  const [tasks, setTasks] = useState<DailyTask[]>(() => {
    // Deduplicate initial tasks
    const seen = new Set<string>();
    return initialTasks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [mounted, setMounted] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const [timelineStartTime, setTimelineStartTime] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    fetch("/api/google/status")
      .then((res) => res.json())
      .then((data) => setGoogleConnected(data.connected))
      .catch(() => {});
  }, []);

  // ルーティンタスク自動生成（日付ごとに1回）
  useEffect(() => {
    fetch("/api/routines/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.count > 0) {
          // 新しいルーティンが生成された場合、ページをリフレッシュして取得
          router.refresh();
        }
      })
      .catch(() => {});
  }, [date, router]);

  // ローカル日付ヘルパー
  const getLocalToday = useCallback(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const isToday = date === getLocalToday();

  // 「今日」表示中に日付が変わったら自動ナビゲーション
  useEffect(() => {
    if (!isToday) return; // 過去の日付を見ている場合はリダイレクトしない

    const checkDateChange = () => {
      const today = getLocalToday();
      if (today !== date) {
        router.push(`/today?date=${today}`);
      }
    };

    const interval = setInterval(checkDateChange, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkDateChange();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [date, isToday, getLocalToday, router]);

  // initialTasksが変わった時にtasksを更新（日付ナビゲーション時）
  useEffect(() => {
    const seen = new Set<string>();
    setTasks(
      initialTasks.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
    );
  }, [initialTasks]);

  // 日付ナビゲーション
  const navigateDate = useCallback(
    (offset: number) => {
      const d = new Date(date + "T00:00:00");
      d.setDate(d.getDate() + offset);
      const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      router.push(`/today?date=${newDate}`);
    },
    [date, router]
  );

  const goToToday = useCallback(() => {
    router.push(`/today?date=${getLocalToday()}`);
  }, [getLocalToday, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...tasks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // Update sort_order locally
      const updated = reordered.map((t, i) => ({ ...t, sort_order: i }));
      setTasks(updated);

      // Persist to DB
      const updates = updated.map((t) =>
        supabase
          .from("daily_tasks")
          .update({ sort_order: t.sort_order })
          .eq("id", t.id)
      );
      await Promise.all(updates);
    },
    [tasks, supabase]
  );

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("daily_tasks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_tasks",
          filter: `date=eq.${date}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => {
              const newTask = payload.new as DailyTask;
              if (newTask.dismissed) return prev;
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as DailyTask;
            if (updated.dismissed) {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id));
            } else {
              setTasks((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t))
              );
            }
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) =>
              prev.filter((t) => t.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, date]);

  const handleStartTask = useCallback(
    async (taskId: string) => {
      const now = new Date().toISOString();

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return { ...t, status: "in_progress" as const, started_at: now };
          }
          return t;
        })
      );

      // DB update
      const { error } = await supabase
        .from("daily_tasks")
        .update({
          status: "in_progress",
          started_at: now,
        })
        .eq("id", taskId);

      if (error) {
        console.error("Failed to start task:", error);
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "pending" as const, started_at: null }
              : t
          )
        );
      }
    },
    [supabase]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const startedAt = task.started_at;
      const elapsed = startedAt
        ? Math.round(
            (Date.now() - new Date(startedAt).getTime()) / 60000
          )
        : 0;

      const completedAt = new Date().toISOString();
      const actualMinutes = (task.actual_minutes ?? 0) + elapsed;

      // Optimistic update — started_atは保持（Googleカレンダー用）
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "done" as const,
                completed_at: completedAt,
                actual_minutes: actualMinutes,
              }
            : t
        )
      );

      // DB update — started_atを保持（エクスポートで使う）
      await supabase
        .from("daily_tasks")
        .update({
          status: "done",
          completed_at: completedAt,
          actual_minutes: actualMinutes,
        })
        .eq("id", taskId);

      // Googleカレンダーにエクスポート
      if (!task.google_event_id && googleConnected) {
        try {
          const res = await fetch("/api/google/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId,
              title: task.title,
              startedAt,
              completedAt,
              actualMinutes,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.eventId) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? { ...t, google_event_id: data.eventId }
                    : t
                )
              );
            }
          } else {
            const errText = await res.text();
            console.warn("Google Calendar export failed:", res.status, errText);
            if (res.status === 403 || res.status === 401) {
              setExportMessage("⚠️ Googleカレンダーの権限エラー。設定で再接続してください。");
              setTimeout(() => setExportMessage(null), 6000);
            } else {
              setExportMessage(`⚠️ カレンダー連携失敗: 「カレンダー送信」で再送できます`);
              setTimeout(() => setExportMessage(null), 5000);
            }
          }
        } catch (e) {
          console.warn("Google Calendar export error:", e);
          setExportMessage("⚠️ カレンダー連携失敗: 「カレンダー送信」で再送できます");
          setTimeout(() => setExportMessage(null), 5000);
        }
      }
    },
    [tasks, supabase, googleConnected]
  );

  const handleRevertTask = useCallback(
    async (taskId: string) => {
      const prevTask = tasks.find((t) => t.id === taskId);
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "pending" as const, completed_at: null, started_at: null }
            : t
        )
      );

      const { error } = await supabase
        .from("daily_tasks")
        .update({ status: "pending", completed_at: null, started_at: null })
        .eq("id", taskId);

      if (error) {
        console.error("Failed to revert task:", error);
        if (prevTask) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
        }
      }
    },
    [supabase, tasks]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const prevTask = tasks.find((t) => t.id === taskId);
      // Optimistic update
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      // ルーティンタスク（template_id付き）はソフトデリートで再生成を防止
      const isRoutine = prevTask?.template_id != null;
      const { error } = isRoutine
        ? await supabase.from("daily_tasks").update({ dismissed: true }).eq("id", taskId)
        : await supabase.from("daily_tasks").delete().eq("id", taskId);

      if (error) {
        console.error("Failed to delete task:", error);
        if (prevTask) {
          setTasks((prev) => [...prev, prevTask]);
        }
      }
    },
    [supabase, tasks]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<DailyTask>) => {
      const prevTask = tasks.find((t) => t.id === taskId);
      const movingToAnotherDate = updates.date && updates.date !== date;

      // Optimistic update — 別日に移動する場合はリストから削除
      if (movingToAnotherDate) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
        );
      }

      const dbUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([key]) => !["id", "user_id", "created_at"].includes(key)
        )
      );
      const { error } = await supabase
        .from("daily_tasks")
        .update(dbUpdates)
        .eq("id", taskId);

      if (error) {
        console.error("Failed to update task:", error);
        if (prevTask) {
          if (movingToAnotherDate) {
            setTasks((prev) => [...prev, prevTask]);
          } else {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
          }
        }
      }
    },
    [supabase, tasks]
  );

  const handleAddToRoutine = useCallback(
    async (task: DailyTask) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 同名テンプレートが既にあるかチェック
      const { data: existing } = await supabase
        .from("task_templates")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", task.title)
        .limit(1);

      if (existing && existing.length > 0) {
        setRoutineMessage("このタスクは既にルーティンに登録されています");
        setTimeout(() => setRoutineMessage(null), 3000);
        return;
      }

      // 最大sort_order取得
      const { data: allTemplates } = await supabase
        .from("task_templates")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxSort = (allTemplates?.[0]?.sort_order as number) ?? 0;

      await supabase.from("task_templates").insert({
        user_id: user.id,
        title: task.title,
        estimated_minutes: task.estimated_minutes,
        section_id: task.section_id,
        eisenhower_quadrant: task.eisenhower_quadrant,
        time_block: task.time_block,
        is_routine: true,
        sort_order: maxSort + 1,
      });

      setRoutineMessage(`「${task.title}」をルーティンに追加しました`);
      setTimeout(() => setRoutineMessage(null), 3000);
    },
    [supabase]
  );

  const handleAddTask = useCallback(
    async (
      title: string,
      estimatedMinutes: number,
      sectionId: string | null,
      eisenhowerQuadrant: EisenhowerQuadrant | null,
      timeRange: { startedAt: string; completedAt: string; actualMinutes: number } | null,
      timeBlock: TimeBlock | null,
      scheduledStart: string | null = null,
      scheduledEnd: string | null = null,
      targetDate: string | null = null,
      startImmediately = false
    ) => {
      const taskDate = targetDate || date;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const maxSort = tasks.reduce(
        (max, t) => Math.max(max, t.sort_order ?? 0),
        0
      );

      const now = new Date().toISOString();

      // 時間指定がある場合は完了済みタスクとして追加
      const insertData = timeRange
        ? {
            user_id: user.id,
            date: taskDate,
            title,
            estimated_minutes: estimatedMinutes,
            section_id: sectionId,
            eisenhower_quadrant: eisenhowerQuadrant,
            time_block: timeBlock,
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            sort_order: maxSort + 1,
            status: "done" as const,
            started_at: timeRange.startedAt,
            completed_at: timeRange.completedAt,
            actual_minutes: timeRange.actualMinutes,
          }
        : {
            user_id: user.id,
            date: taskDate,
            title,
            estimated_minutes: estimatedMinutes,
            section_id: sectionId,
            eisenhower_quadrant: eisenhowerQuadrant,
            time_block: timeBlock,
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            sort_order: maxSort + 1,
            ...(startImmediately
              ? { status: "in_progress" as const, started_at: now }
              : { status: "pending" as const }),
          };

      const { data } = await supabase
        .from("daily_tasks")
        .insert(insertData)
        .select()
        .single();

      if (data && taskDate === date) {
        setTasks((prev) => [...prev, data]);
      }
    },
    [supabase, date, tasks]
  );

  const handleImportCalendar = useCallback(async () => {
    setImporting(true);
    setImportMessage(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/google/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, timezone }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMessage(data.message);
      } else {
        setImportMessage(data.error || "インポートに失敗しました");
      }
    } catch {
      setImportMessage("インポートに失敗しました");
    }
    setImporting(false);
    setTimeout(() => setImportMessage(null), 4000);
  }, [date]);

  const handleExportCalendar = useCallback(async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/google/export-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, timezone, days: 7 }),
      });
      const data = await res.json();
      if (res.ok) {
        setExportMessage(data.message);
      } else {
        setExportMessage(data.error || "エクスポートに失敗しました");
      }
    } catch {
      setExportMessage("エクスポートに失敗しました");
    }
    setExporting(false);
    setTimeout(() => setExportMessage(null), 4000);
  }, [date]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // セクションごとにタスクをグループ化
  const tasksBySection = new Map<string | null, DailyTask[]>();
  tasks.forEach((task) => {
    const key = task.section_id;
    if (!tasksBySection.has(key)) {
      tasksBySection.set(key, []);
    }
    tasksBySection.get(key)!.push(task);
  });

  const sectionOrder = [...sections, null]; // nullは「未分類」

  const dndWrapper = mounted
    ? (children: React.ReactNode) => (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {children}
        </DndContext>
      )
    : (children: React.ReactNode) => <>{children}</>;

  return dndWrapper(
      <div className="mx-auto max-w-3xl p-4 pb-24 sm:p-6">
        {/* 終了予定時刻バー */}
        <EndTimeBar tasks={tasks} />

        {/* マトリクス分析サマリー */}
        <EisenhowerSummary tasks={tasks} />

        {/* タイムライン表示 */}
        <TimelineView tasks={tasks} onTimeClick={setTimelineStartTime} />

        {/* 日付表示 + ナビゲーション */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate(-1)}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-navy-700 hover:text-white"
                title="前日"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-white">
                {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </h2>
              <button
                onClick={() => navigateDate(1)}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-navy-700 hover:text-white"
                title="翌日"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="ml-2 rounded-lg bg-green-accent/10 px-3 py-1 text-xs font-medium text-green-accent transition hover:bg-green-accent/20"
                >
                  今日
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {googleConnected && (
                <>
                  <button
                    onClick={handleExportCalendar}
                    disabled={exporting}
                    className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-gray-300 transition hover:border-blue-400 hover:text-blue-400 disabled:opacity-50"
                  >
                    {exporting ? "送信中..." : "📤 カレンダー送信"}
                  </button>
                  <button
                    onClick={handleImportCalendar}
                    disabled={importing}
                    className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-gray-300 transition hover:border-green-accent hover:text-green-accent disabled:opacity-50"
                  >
                    {importing ? "取込中..." : "📅 カレンダー取込"}
                  </button>
                </>
              )}
              <div className="text-sm text-gray-400">
                {tasks.filter((t) => t.status === "done").length}/{tasks.length}{" "}
                完了
              </div>
            </div>
          </div>
        </div>
        {importMessage && (
          <div className="mb-4 rounded-lg bg-green-accent/10 px-4 py-2 text-sm text-green-accent">
            {importMessage}
          </div>
        )}
        {exportMessage && (
          <div className="mb-4 rounded-lg bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
            {exportMessage}
          </div>
        )}
        {routineMessage && (
          <div className="mb-4 rounded-lg bg-green-accent/10 px-4 py-2 text-sm text-green-accent">
            {routineMessage}
          </div>
        )}

        {/* 週次・月次の目標 */}
        <PeriodicGoals
          initialWeeklyGoals={initialWeeklyGoals}
          initialMonthlyGoals={initialMonthlyGoals}
          date={date}
        />

        {/* タスクタイムライン */}
        {sectionOrder.map((section) => {
          const sectionId = section?.id ?? null;
          const sectionName = section?.name ?? "未分類";
          const sectionTasks = tasksBySection.get(sectionId) ?? [];
          const isCollapsed = collapsedSections.has(sectionId ?? "none");
          const doneCount = sectionTasks.filter(
            (t) => t.status === "done"
          ).length;

          if (sectionTasks.length === 0 && sectionId !== null) return null;

          const sortedTasks = sectionTasks.sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          );

          return (
            <div key={sectionId ?? "none"} className="mb-6">
              {sectionId !== null && (
                <button
                  onClick={() => toggleSection(sectionId ?? "none")}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  <span
                    className={`text-xs text-gray-500 transition ${isCollapsed ? "" : "rotate-90"}`}
                  >
                    &#9654;
                  </span>
                  <span className="text-sm font-semibold text-gray-300">
                    {sectionName}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({doneCount}/{sectionTasks.length})
                  </span>
                </button>
              )}

              {!isCollapsed && mounted && (
                <SortableContext
                  items={sortedTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onStart={handleStartTask}
                        onComplete={handleCompleteTask}
                        onDelete={handleDeleteTask}
                        onUpdate={handleUpdateTask}
                        onAddToRoutine={handleAddToRoutine}
                        onRevert={handleRevertTask}
                        sections={sections}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
              {!isCollapsed && !mounted && (
                <div className="space-y-2">
                  {sortedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStart={handleStartTask}
                      onComplete={handleCompleteTask}
                      onDelete={handleDeleteTask}
                      onUpdate={handleUpdateTask}
                      onAddToRoutine={handleAddToRoutine}
                      onRevert={handleRevertTask}
                      sections={sections}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* タスク追加フォーム */}
        <AddTaskForm
          sections={sections}
          onAdd={handleAddTask}
          date={date}
          initialStartTime={timelineStartTime}
          onResetInitialTime={() => setTimelineStartTime(null)}
        />

        {/* AIチャットパネル */}
        <AIChatPanel />
      </div>
  );
}
