"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DailyTask } from "@/lib/types";
import TaskCard from "./TaskCard";

export default function SortableTaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
  onUpdate,
  onAddToRoutine,
}: {
  task: DailyTask;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<DailyTask>) => void;
  onAddToRoutine?: (task: DailyTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1">
      <button
        className="flex w-6 flex-shrink-0 cursor-grab items-center justify-center rounded-l-lg text-gray-600 transition hover:bg-navy-700 hover:text-gray-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <div className="flex-1">
        <TaskCard
          task={task}
          onStart={onStart}
          onComplete={onComplete}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAddToRoutine={onAddToRoutine}
        />
      </div>
    </div>
  );
}
