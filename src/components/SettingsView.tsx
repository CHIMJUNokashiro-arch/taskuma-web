"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const supabase = createClient();

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
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const trimmed = editName.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      await supabase.from("sections").update({ name: trimmed }).eq("id", id);
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s))
      );
      setEditingId(null);
    },
    [editName, supabase]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
  }, []);

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
          タスクを分類するセクション（例：朝、午前、午後、夜）を管理します。
        </p>

        <div className="mb-4 space-y-2">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-lg border border-navy-600 p-3"
            >
              {editingId === section.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(section.id);
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  onBlur={() => handleSaveEdit(section.id)}
                  autoFocus
                  className="flex-1 rounded border border-green-accent bg-navy-900 px-2 py-1 text-white focus:outline-none"
                />
              ) : (
                <span
                  className="cursor-pointer text-white"
                  onDoubleClick={() => handleStartEdit(section)}
                >
                  {section.name}
                </span>
              )}
              <div className="ml-2 flex gap-2">
                {editingId === section.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(section.id)}
                      className="text-sm text-green-accent transition hover:text-green-400"
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-sm text-gray-500 transition hover:text-gray-300"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(section)}
                      className="text-sm text-gray-500 transition hover:text-green-accent"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      className="text-sm text-gray-500 transition hover:text-red-400"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
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
