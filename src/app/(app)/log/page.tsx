import { createClient } from "@/lib/supabase/server";
import LogView from "@/components/LogView";
import LogAnalyticsView from "@/components/LogAnalyticsView";

function computeDateRange(
  view: string,
  dateParam?: string
): { fromDate: string; toDate: string } {
  const ref = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (view === "weekly") {
    // 月曜始まり（ISO方式）
    const day = ref.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { fromDate: fmt(monday), toDate: fmt(sunday) };
  }

  if (view === "monthly") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { fromDate: fmt(first), toDate: fmt(last) };
  }

  // yearly
  return {
    fromDate: `${ref.getFullYear()}-01-01`,
    toDate: `${ref.getFullYear()}-12-31`,
  };
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { view = "daily", date: dateParam } = await searchParams;
  const supabase = await createClient();

  if (view === "daily") {
    // 既存の日別ビュー（過去30日）
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

  // 週別 / 月別 / 年別
  const { fromDate, toDate } = computeDateRange(view, dateParam);

  const [tasksRes, templatesRes] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("task_templates")
      .select("id, title, is_routine"),
  ]);

  const currentDate =
    dateParam ?? new Date().toISOString().split("T")[0];

  return (
    <LogAnalyticsView
      tasks={tasksRes.data ?? []}
      templates={templatesRes.data ?? []}
      view={view as "weekly" | "monthly" | "yearly"}
      fromDate={fromDate}
      toDate={toDate}
      currentDate={currentDate}
    />
  );
}
