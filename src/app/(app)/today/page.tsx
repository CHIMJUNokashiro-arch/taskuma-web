import { createClient } from "@/lib/supabase/server";
import TodayView from "@/components/TodayView";
import type { DailyTask, Section } from "@/lib/types";

export default async function TodayPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [tasksRes, sectionsRes] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("date", today)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sections")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const tasks: DailyTask[] = tasksRes.data ?? [];
  const sections: Section[] = sectionsRes.data ?? [];

  return <TodayView initialTasks={tasks} sections={sections} date={today} />;
}
