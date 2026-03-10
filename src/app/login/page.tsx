"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-md rounded-2xl bg-navy-800 p-8 text-center shadow-xl">
          <h1 className="mb-4 text-3xl font-bold text-white">
            <span className="text-green-accent">t</span>askuma
          </h1>
          <p className="mb-4 text-gray-400">Supabaseが未設定です。</p>
          <p className="text-sm text-gray-500">
            .env.local に NEXT_PUBLIC_SUPABASE_URL と
            NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("確認メールを送信しました。メールを確認してください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/today");
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            <span className="text-green-accent">t</span>askuma
          </h1>
          <p className="mt-2 text-gray-400">タスクシュート式タスク管理</p>
        </div>

        <div className="rounded-2xl bg-navy-800 p-8 shadow-xl">
          <h2 className="mb-6 text-xl font-semibold text-white">
            {isSignUp ? "アカウント作成" : "ログイン"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm text-gray-300"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-4 py-3 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm text-gray-300"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-navy-600 bg-navy-900 px-4 py-3 text-white placeholder-gray-500 focus:border-green-accent focus:outline-none"
                placeholder="6文字以上"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-green-900/30 p-3 text-sm text-green-400">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-accent py-3 font-semibold text-navy-950 transition hover:bg-green-accent-dark disabled:opacity-50"
            >
              {loading
                ? "処理中..."
                : isSignUp
                  ? "アカウント作成"
                  : "ログイン"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-sm text-gray-400 transition hover:text-green-accent"
            >
              {isSignUp
                ? "アカウントをお持ちの方はこちら"
                : "新規アカウント作成はこちら"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
