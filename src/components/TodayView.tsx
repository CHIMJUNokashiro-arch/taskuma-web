"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyTask, Section } from "@/lib/types";
import SortableTaskCard from "./SortableTaskCard";
import TaskCard from "./TaskCard";
import AddTaskForm from "./AddTaskForm";
import EndTimeBar from "./EndTimeBar";
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
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
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

  const handleAddTask = useCallback(
    async (title: string, estimatedMinutes: number, sectionId: string | null) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const maxSort = tasks.reduce(
        (max, t) => Math.max(max, t.sort_order ?? 0),
        0
      );

      const { data } = await supabase
        .from("daily_tasks")
        .insert({
          user_id: user.id,
          date,
          title,
          estimated_minutes: estimatedMinutes,
          section_id: sectionId,
          sort_order: maxSort + 1,
          status: "pending",
        })
        .select()
        .single();

      if (data) {
        setTasks((prev) => [...prev, data]);
      }
    },
    [supabase, date, tasks]
  );

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
          <div className="text-sm text-gray-400">
            {tasks.filter((t) => t.status === "done").length}/{tasks.length}{" "}
            完了
          </div>
        </div>

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
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* タスク追加フォーム */}
        <AddTaskForm sections={sections} onAdd={handleAddTask} />

        {/* AIチャットパネル */}
        <AIChatPanel />
      </div>
  );
}
