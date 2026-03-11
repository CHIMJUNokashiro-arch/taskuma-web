"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyTask, Section, EisenhowerQuadrant, TimeBlock } from "@/lib/types";
import SortableTaskCard from "./SortableTaskCard";
import TaskCard from "./TaskCard";
import AddTaskForm from "./AddTaskForm";
import EndTimeBar from "./EndTimeBar";
import EisenhowerSummary from "./EisenhowerSummary";
import TimelineView from "./TimelineView";
import AIChatPanel from "./AIChatPanel";
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
}: {
  initialTasks: DailyTask[];
  sections: Section[];
  date: string;
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
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    fetch("/api/google/status")
      .then((res) => res.json())
      .then((data) => setGoogleConnected(data.connected))
      .catch(() => {});
  }, []);

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
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === (payload.new as DailyTask).id
                  ? (payload.new as DailyTask)
                  : t
              )
            );
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
      // 他に実行中のタスクがあれば停止
      const inProgressTask = tasks.find((t) => t.status === "in_progress");
      if (inProgressTask) {
        const elapsed = inProgressTask.started_at
          ? Math.round(
              (Date.now() - new Date(inProgressTask.started_at).getTime()) /
                60000
            )
          : 0;
        await supabase
          .from("daily_tasks")
          .update({
            status: "pending",
            actual_minutes: (inProgressTask.actual_minutes ?? 0) + elapsed,
            started_at: null,
          })
          .eq("id", inProgressTask.id);
      }

      await supabase
        .from("daily_tasks")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    },
    [tasks, supabase]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const elapsed = task.started_at
        ? Math.round(
            (Date.now() - new Date(task.started_at).getTime()) / 60000
          )
        : 0;

      await supabase
        .from("daily_tasks")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          actual_minutes: (task.actual_minutes ?? 0) + elapsed,
          started_at: null,
        })
        .eq("id", taskId);
    },
    [tasks, supabase]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await supabase.from("daily_tasks").delete().eq("id", taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [supabase]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<DailyTask>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, user_id, created_at, ...rest } = updates as DailyTask;
      const dbUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([key]) => !["id", "user_id", "created_at"].includes(key)
        )
      );
      await supabase
        .from("daily_tasks")
        .update(dbUpdates)
        .eq("id", taskId);
    },
    [supabase]
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
      timeBlock: TimeBlock | null
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const maxSort = tasks.reduce(
        (max, t) => Math.max(max, t.sort_order ?? 0),
        0
      );

      // 時間指定がある場合は完了済みタスクとして追加
      const insertData = timeRange
        ? {
            user_id: user.id,
            date,
            title,
            estimated_minutes: estimatedMinutes,
            section_id: sectionId,
            eisenhower_quadrant: eisenhowerQuadrant,
            time_block: timeBlock,
            sort_order: maxSort + 1,
            status: "done" as const,
            started_at: timeRange.startedAt,
            completed_at: timeRange.completedAt,
            actual_minutes: timeRange.actualMinutes,
          }
        : {
            user_id: user.id,
            date,
            title,
            estimated_minutes: estimatedMinutes,
            section_id: sectionId,
            eisenhower_quadrant: eisenhowerQuadrant,
            time_block: timeBlock,
            sort_order: maxSort + 1,
            status: "pending" as const,
          };

      const { data } = await supabase
        .from("daily_tasks")
        .insert(insertData)
        .select()
        .single();

      if (data) {
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

        {/* 日付表示 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </h2>
          <div className="flex items-center gap-3">
            {googleConnected && (
              <button
                onClick={handleImportCalendar}
                disabled={importing}
                className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-gray-300 transition hover:border-green-accent hover:text-green-accent disabled:opacity-50"
              >
                {importing ? "取込中..." : "📅 カレンダー取込"}
              </button>
            )}
            <div className="text-sm text-gray-400">
              {tasks.filter((t) => t.status === "done").length}/{tasks.length}{" "}
              完了
            </div>
          </div>
        </div>
        {importMessage && (
          <div className="mb-4 rounded-lg bg-green-accent/10 px-4 py-2 text-sm text-green-accent">
            {importMessage}
          </div>
        )}
        {routineMessage && (
          <div className="mb-4 rounded-lg bg-green-accent/10 px-4 py-2 text-sm text-green-accent">
            {routineMessage}
          </div>
        )}

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
