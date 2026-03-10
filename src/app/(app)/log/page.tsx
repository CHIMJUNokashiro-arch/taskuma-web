import { createClient } from "@/lib/supabase/server";
import LogView from "@/components/LogView";

export default async function LogPage() {
  const supabase = await createClient();

  // 過去30日のタスクを取得
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: tasks } = await supabase
    .from("daily_tasks")
    .select("*")
    .gte("date", fromDate)
    .order("date", { ascending: false })
    .order("sort_order", { ascending: true });

  return <LogView tasks={tasks ?? []} />;
}
