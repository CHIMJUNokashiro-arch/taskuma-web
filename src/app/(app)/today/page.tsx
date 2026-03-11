import { createClient } from "@/lib/supabase/server";
import TodayView from "@/components/TodayView";
import TodayRedirect from "@/components/TodayRedirect";
import type { DailyTask, Section } from "@/lib/types";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;

  // 日付パラメータがない場合、クライアント側でローカル日付を検出してリダイレクト
  if (!dateParam) {
    return <TodayRedirect />;
  }

  const supabase = await createClient();

  const [tasksRes, sectionsRes] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("date", dateParam)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sections")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const tasks: DailyTask[] = tasksRes.data ?? [];
  const sections: Section[] = sectionsRes.data ?? [];

  return <TodayView initialTasks={tasks} sections={sections} date={dateParam} />;
}
