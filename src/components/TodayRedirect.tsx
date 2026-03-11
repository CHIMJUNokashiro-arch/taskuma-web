"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TodayRedirect() {
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    router.replace(`/today?date=${date}`);
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-gray-500">読み込み中...</div>
    </div>
  );
}
