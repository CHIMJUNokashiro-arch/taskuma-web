"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Section } from "@/lib/types";

export default function SettingsView({
  sections: initialSections,
}: {
  sections: Section[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [newSectionName, setNewSectionName] = useState("");
  const [generatingRoutines, setGeneratingRoutines] = useState(false);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const supabase = createClient();

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

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h2 className="mb-6 text-xl font-bold text-white">設定</h2>

      {/* セクション管理 */}
      <div className="mb-8 rounded-xl bg-navy-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          セクション管理
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          タスクを分類するセクション（例：朝、午前、午後、夜）を管理します。
        </p>

        <div className="mb-4 space-y-2">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-lg border border-navy-600 p-3"
            >
              <span className="text-white">{section.name}</span>
              <button
                onClick={() => handleDeleteSection(section.id)}
                className="text-sm text-gray-500 transition hover:text-red-400"
              >
                削除
              </button>
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-sm text-gray-500">
              セクションがありません。
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="セクション名（例：朝）"
            className="flex-1 rounded-lg border border-navy-600 bg-navy-900 px-4 py-2 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
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
