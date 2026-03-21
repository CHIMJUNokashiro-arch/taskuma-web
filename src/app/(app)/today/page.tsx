import { createClient } from "@/lib/supabase/server";
import TodayView from "@/components/TodayView";
import TodayRedirect from "@/components/TodayRedirect";
import type { DailyTask, Section, PeriodicGoal } from "@/lib/types";

function getWeekRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { start: fmt(mon), end: fmt(sun) };
}

function getMonthRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { start, end };
}

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

  const weekRange = getWeekRange(dateParam);
  const monthRange = getMonthRange(dateParam);

  const [tasksRes, sectionsRes, weeklyGoalsRes, monthlyGoalsRes] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("date", dateParam)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sections")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("periodic_goals")
      .select("*")
      .eq("period_type", "weekly")
      .eq("period_start", weekRange.start)
      .order("sort_order", { ascending: true }),
    supabase
      .from("periodic_goals")
      .select("*")
      .eq("period_type", "monthly")
      .eq("period_start", monthRange.start)
      .order("sort_order", { ascending: true }),
  ]);

  const tasks: DailyTask[] = tasksRes.data ?? [];
  const sections: Section[] = sectionsRes.data ?? [];
  const weeklyGoals: PeriodicGoal[] = weeklyGoalsRes.data ?? [];
  const monthlyGoals: PeriodicGoal[] = monthlyGoalsRes.data ?? [];

  return (
    <TodayView
      initialTasks={tasks}
      sections={sections}
      date={dateParam}
      initialWeeklyGoals={weeklyGoals}
      initialMonthlyGoals={monthlyGoals}
    />
  );
}
