"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TaskTemplate, Section, EisenhowerQuadrant, TimeBlock } from "@/lib/types";
import {
  EISENHOWER_QUADRANTS,
  EISENHOWER_LABELS,
  EISENHOWER_COLORS,
  TIME_BLOCKS,
  TIME_BLOCK_LABELS,
  TIME_BLOCK_COLORS,
} from "@/lib/types";

export default function TemplatesView({
  initialTemplates,
  sections,
}: {
  initialTemplates: TaskTemplate[];
  sections: Section[];
}) {
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [estimated, setEstimated] = useState(30);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [isRoutine, setIsRoutine] = useState(false);
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant | null>(null);
  const [timeBlock, setTimeBlock] = useState<TimeBlock | null>(null);
  const supabase = createClient();

  const resetForm = () => {
    setTitle("");
    setEstimated(30);
    setSectionId(null);
    setIsRoutine(false);
    setQuadrant(null);
    setTimeBlock(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = useCallback(async () => {
    if (!title.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const maxSort = templates.reduce(
      (max, t) => Math.max(max, t.sort_order ?? 0),
      0
    );

    const { data } = await supabase
      .from("task_templates")
      .insert({
        user_id: user.id,
        title: title.trim(),
        estimated_minutes: estimated,
        section_id: sectionId,
        is_routine: isRoutine,
        eisenhower_quadrant: quadrant,
        time_block: timeBlock,
        sort_order: maxSort + 1,
      })
      .select()
      .single();

    if (data) {
      setTemplates((prev) => [...prev, data]);
      resetForm();
    }
  }, [title, estimated, sectionId, isRoutine, quadrant, timeBlock, templates, supabase]);

  const handleUpdate = useCallback(
    async (id: string) => {
      await supabase
        .from("task_templates")
        .update({
          title: title.trim(),
          estimated_minutes: estimated,
          section_id: sectionId,
          is_routine: isRoutine,
          eisenhower_quadrant: quadrant,
          time_block: timeBlock,
        })
        .eq("id", id);

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                title: title.trim(),
                estimated_minutes: estimated,
                section_id: sectionId,
                is_routine: isRoutine,
                eisenhower_quadrant: quadrant,
                time_block: timeBlock,
              }
            : t
        )
      );
      resetForm();
    },
    [title, estimated, sectionId, isRoutine, quadrant, timeBlock, supabase]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await supabase.from("task_templates").delete().eq("id", id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [supabase]
  );

  const startEdit = (template: TaskTemplate) => {
    setEditingId(template.id);
    setTitle(template.title);
    setEstimated(template.estimated_minutes);
    setSectionId(template.section_id);
    setIsRoutine(template.is_routine);
    setQuadrant(template.eisenhower_quadrant);
    setTimeBlock(template.time_block);
  };

  const getSectionName = (id: string | null) =>
    sections.find((s) => s.id === id)?.name ?? "未分類";

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">ルーティンタスク管理</h2>
        <button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
        >
          + 追加
        </button>
      </div>

      {/* 追加/編集フォーム */}
      {(isAdding || editingId) && (
        <div className="mb-6 rounded-xl border border-navy-600 bg-navy-800 p-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タスク名"
            autoFocus
            className="mb-3 w-full rounded-lg border border-navy-600 bg-navy-900 px-4 py-2 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
          />
          <div className="mb-3 flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400">
                見積もり（分）
              </label>
              <input
                type="number"
                value={estimated}
                onChange={(e) => setEstimated(Number(e.target.value))}
                min={1}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-white focus:border-green-accent focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400">
                セクション
              </label>
              <select
                value={sectionId ?? ""}
                onChange={(e) => setSectionId(e.target.value || null)}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-white focus:border-green-accent focus:outline-none"
              >
                <option value="">未分類</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* アイゼンハワー象限セレクター */}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-400">
              重要度・緊急度
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EISENHOWER_QUADRANTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuadrant(quadrant === q ? null : q)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    quadrant === q
                      ? `${EISENHOWER_COLORS[q].bg} ${EISENHOWER_COLORS[q].text} ${EISENHOWER_COLORS[q].border} border`
                      : "border border-navy-600 text-gray-500 hover:border-navy-400"
                  }`}
                >
                  {EISENHOWER_LABELS[q]}
                </button>
              ))}
            </div>
          </div>
          {/* タイムブロック選択 */}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-400">
              タイムブロック
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIME_BLOCKS.map((tb) => (
                <button
                  key={tb}
                  type="button"
                  onClick={() => setTimeBlock(timeBlock === tb ? null : tb)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    timeBlock === tb
                      ? `${TIME_BLOCK_COLORS[tb].bg} ${TIME_BLOCK_COLORS[tb].text} ${TIME_BLOCK_COLORS[tb].border} border`
                      : "border border-navy-600 text-gray-500 hover:border-navy-400"
                  }`}
                >
                  {TIME_BLOCK_LABELS[tb]}
                </button>
              ))}
            </div>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isRoutine}
              onChange={(e) => setIsRoutine(e.target.checked)}
              className="rounded border-navy-600 bg-navy-900 text-green-accent focus:ring-green-accent"
            />
            毎日繰り返し（ルーティン）
          </label>
          <div className="flex gap-2">
            <button
              onClick={() =>
                editingId ? handleUpdate(editingId) : handleAdd()
              }
              className="rounded-lg bg-green-accent px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
            >
              {editingId ? "更新" : "追加"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-navy-600 px-4 py-2 text-sm text-gray-400 transition hover:bg-navy-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* テンプレート一覧 */}
      <div className="space-y-2">
        {templates.length === 0 && (
          <p className="py-12 text-center text-gray-500">
            ルーティンタスクがまだありません。「+ 追加」から作成しましょう。
          </p>
        )}
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between rounded-xl border border-navy-600 bg-navy-800 p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">{template.title}</h3>
                {template.eisenhower_quadrant && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EISENHOWER_COLORS[template.eisenhower_quadrant].badge}`}
                  >
                    {EISENHOWER_LABELS[template.eisenhower_quadrant]}
                  </span>
                )}
                {template.time_block && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TIME_BLOCK_COLORS[template.time_block].badge}`}
                  >
                    {TIME_BLOCK_LABELS[template.time_block]}
                  </span>
                )}
                {template.is_routine && (
                  <span className="rounded-full bg-green-accent/10 px-2 py-0.5 text-xs text-green-accent">
                    ルーティン
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-3 text-xs text-gray-500">
                <span>{template.estimated_minutes}分</span>
                <span>{getSectionName(template.section_id)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(template)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-navy-700 hover:text-white"
                title="編集"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-navy-700 hover:text-red-400"
                title="削除"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
