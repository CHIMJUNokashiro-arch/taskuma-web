"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Section } from "@/lib/types";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSectionItem({
  section,
  editingId,
  editName,
  setEditName,
  editMinutes,
  setEditMinutes,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
}: {
  section: Section;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  editMinutes: number;
  setEditMinutes: (v: number) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (section: Section) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-lg border border-navy-600 p-3"
    >
      <div className="flex items-center gap-2">
        {/* ドラッグハンドル */}
        <button
          className="flex w-6 flex-shrink-0 cursor-grab items-center justify-center text-gray-600 transition hover:text-gray-400 active:cursor-grabbing"
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
        {editingId === section.id ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") onSaveEdit(section.id);
                if (e.key === "Escape") onCancelEdit();
              }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-green-accent bg-navy-900 px-2 py-1 text-white focus:outline-none"
            />
            <input
              type="number"
              value={editMinutes}
              onChange={(e) => setEditMinutes(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") onSaveEdit(section.id);
                if (e.key === "Escape") onCancelEdit();
              }}
              min={1}
              className="w-16 rounded border border-green-accent bg-navy-900 px-2 py-1 text-white focus:outline-none"
            />
            <span className="text-xs text-gray-400">分</span>
          </div>
        ) : (
          <div
            className="flex flex-1 cursor-pointer items-center gap-2"
            onClick={() => onStartEdit(section)}
          >
            <span className="text-white">
              {section.name}
            </span>
            <span className="text-xs text-gray-500">
              {section.default_estimated_minutes ?? 60}分
            </span>
          </div>
        )}
      </div>
      <div className="ml-2 flex flex-shrink-0 gap-2">
        {editingId === section.id ? (
          <>
            <button
              onClick={() => onSaveEdit(section.id)}
              className="text-sm text-green-accent transition hover:text-green-400"
            >
              保存
            </button>
            <button
              onClick={onCancelEdit}
              className="text-sm text-gray-500 transition hover:text-gray-300"
            >
              取消
            </button>
          </>
        ) : (
          <button
            onClick={() => onDelete(section.id)}
            className="text-sm text-gray-500 transition hover:text-red-400"
          >
            削除
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsView({
  sections: initialSections,
}: {
  sections: Section[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [newSectionName, setNewSectionName] = useState("");
  const [generatingRoutines, setGeneratingRoutines] = useState(false);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMinutes, setEditMinutes] = useState(60);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetch("/api/google/status")
      .then((res) => res.json())
      .then((data) => {
        setGoogleConnected(data.connected);
        setGoogleEmail(data.email);
      })
      .catch(() => {});
  }, []);

  const handleAddSection = useCallback(async () => {
    if (!newSectionName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const maxSort = sections.reduce(
      (max, s) => Math.max(max, s.sort_order ?? 0),
      0
    );

    const { data } = await supabase
      .from("sections")
      .insert({
        user_id: user.id,
        name: newSectionName.trim(),
        sort_order: maxSort + 1,
      })
      .select()
      .single();

    if (data) {
      setSections((prev) => [...prev, data]);
      setNewSectionName("");
    }
  }, [newSectionName, sections, supabase]);

  const handleDeleteSection = useCallback(
    async (id: string) => {
      await supabase.from("sections").delete().eq("id", id);
      setSections((prev) => prev.filter((s) => s.id !== id));
    },
    [supabase]
  );

  const handleStartEdit = useCallback((section: Section) => {
    setEditingId(section.id);
    setEditName(section.name);
    setEditMinutes(section.default_estimated_minutes ?? 60);
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const trimmed = editName.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      const mins = Math.max(1, editMinutes);
      await supabase
        .from("sections")
        .update({ name: trimmed, default_estimated_minutes: mins })
        .eq("id", id);
      setSections((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, name: trimmed, default_estimated_minutes: mins }
            : s
        )
      );
      setEditingId(null);
    },
    [editName, editMinutes, supabase]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditMinutes(60);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...sections];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      const updated = reordered.map((s, i) => ({ ...s, sort_order: i }));
      setSections(updated);

      // DB更新
      await Promise.all(
        updated.map((s) =>
          supabase
            .from("sections")
            .update({ sort_order: s.sort_order })
            .eq("id", s.id)
        )
      );
    },
    [sections, supabase]
  );

  const handleGenerateRoutines = useCallback(async () => {
    setGeneratingRoutines(true);
    setRoutineMessage(null);
    try {
      const res = await fetch("/api/routines/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      setRoutineMessage(data.message);
    } catch {
      setRoutineMessage("エラーが発生しました");
    }
    setGeneratingRoutines(false);
  }, []);

  const handleDisconnectGoogle = useCallback(async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setGoogleConnected(false);
      setGoogleEmail(null);
    } catch {
      // ignore
    }
    setDisconnecting(false);
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h2 className="mb-6 text-xl font-bold text-white">設定</h2>

      {/* Googleカレンダー連携 */}
      <div className="mb-8 rounded-xl bg-navy-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Googleカレンダー連携
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          Googleカレンダーのイベントをタスクとしてインポートできます。
        </p>

        {googleConnected ? (
          <div>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-accent/30 bg-green-accent/10 p-3">
              <span className="text-green-accent">&#10003;</span>
              <span className="text-sm text-white">
                接続済み{googleEmail ? `（${googleEmail}）` : ""}
              </span>
            </div>
            <button
              onClick={handleDisconnectGoogle}
              disabled={disconnecting}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {disconnecting ? "解除中..." : "連携を解除"}
            </button>
          </div>
        ) : (
          <a
            href="/api/google/auth"
            className="inline-block rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
          >
            Googleアカウントを接続
          </a>
        )}
      </div>

      {/* セクション管理 */}
      <div className="mb-8 rounded-xl bg-navy-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          セクション管理
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          タスクを分類するセクション（例：朝、午前、午後、夜）を管理します。ドラッグで並び替えできます。
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mb-4 space-y-2">
              {sections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  editingId={editingId}
                  editName={editName}
                  setEditName={setEditName}
                  editMinutes={editMinutes}
                  setEditMinutes={setEditMinutes}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onStartEdit={handleStartEdit}
                  onDelete={handleDeleteSection}
                />
              ))}
              {sections.length === 0 && (
                <p className="text-sm text-gray-500">
                  セクションがありません。
                </p>
              )}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="セクション名（例：朝）"
            className="flex-1 rounded-lg border border-navy-600 bg-navy-900 px-4 py-2 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
            onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" && handleAddSection()}
          />
          <button
            onClick={handleAddSection}
            className="rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
          >
            追加
          </button>
        </div>
      </div>

      {/* ルーティン生成 */}
      <div className="mb-8 rounded-xl bg-navy-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          ルーティン生成
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          ルーティンタスクを今日の予定に手動で生成します。通常は毎日自動で生成されます。
        </p>
        <button
          onClick={handleGenerateRoutines}
          disabled={generatingRoutines}
          className="rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark disabled:opacity-50"
        >
          {generatingRoutines ? "生成中..." : "今日のルーティンを生成"}
        </button>
        {routineMessage && (
          <p className="mt-2 text-sm text-green-accent">{routineMessage}</p>
        )}
      </div>

      {/* アカウント情報 */}
      <div className="rounded-xl bg-navy-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          アカウント
        </h3>
        <p className="text-sm text-gray-400">
          アカウントの管理はSupabaseダッシュボードから行えます。
        </p>
      </div>
    </div>
  );
}
