import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/today");
    }
  } catch {
    // Supabase未設定時はランディングページを表示
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold">
          <span className="text-green-accent">t</span>askuma
        </h1>
        <Link
          href="/login"
          className="rounded-lg bg-green-accent px-5 py-2 text-sm font-semibold text-navy-950 transition hover:bg-green-accent-dark"
        >
          ログイン
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl">
          あなたの1日を
          <br />
          <span className="text-green-accent">タスクシュート</span>で管理
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-lg text-gray-400">
          タスクを上から順番に実行し、実績時間を記録。
          AIが過去のログから今日やるべきタスクを提案します。
        </p>

        <div className="mb-16 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-green-accent px-8 py-3 text-lg font-semibold text-navy-950 transition hover:bg-green-accent-dark"
          >
            無料で始める
          </Link>
        </div>

        <div className="grid gap-8 text-left sm:grid-cols-3">
          <div className="rounded-xl bg-navy-800 p-6">
            <div className="mb-3 text-3xl">&#9200;</div>
            <h3 className="mb-2 text-lg font-semibold">タイムライン管理</h3>
            <p className="text-sm text-gray-400">
              1日のタスクを縦一列に並べ、見積もり時間から終了予定時刻をリアルタイム計算
            </p>
          </div>
          <div className="rounded-xl bg-navy-800 p-6">
            <div className="mb-3 text-3xl">&#128260;</div>
            <h3 className="mb-2 text-lg font-semibold">ルーティン自動生成</h3>
            <p className="text-sm text-gray-400">
              毎日のルーティンタスクを自動でコピー。設定するだけで翌日に反映
            </p>
          </div>
          <div className="rounded-xl bg-navy-800 p-6">
            <div className="mb-3 text-3xl">&#129302;</div>
            <h3 className="mb-2 text-lg font-semibold">AIタスク提案</h3>
            <p className="text-sm text-gray-400">
              過去1週間のログをAIが分析し、今日やるべきタスクを自動提案
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
