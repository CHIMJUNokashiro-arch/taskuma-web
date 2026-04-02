import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
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

function getMonthRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { start, end };
}

// ルーティンタスクを指定日に自動生成する
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await request.json();
  const targetDate = date || new Date().toISOString().split("T")[0];

  // ルーティンテンプレートを取得
  const { data: routines } = await supabase
    .from("task_templates")
    .select("*")
    .eq("is_routine", true)
    .order("sort_order", { ascending: true });

  if (!routines || routines.length === 0) {
    return NextResponse.json({ message: "No routines found", count: 0 });
  }

  // 日次/平日テンプレートと週次/月次テンプレートを分離
  const dailyRoutines = routines.filter((r) => {
    const type = r.recurrence_type ?? "daily";
    return type === "daily" || type === "weekdays";
  });
  const weeklyRoutines = routines.filter((r) => (r.recurrence_type ?? "daily") === "weekly");
  const monthlyRoutines = routines.filter((r) => (r.recurrence_type ?? "daily") === "monthly");

  let generatedCount = 0;

  // ===== 日次/平日タスク → daily_tasks =====
  if (dailyRoutines.length > 0) {
    const { data: existingTasks } = await supabase
      .from("daily_tasks")
      .select("template_id")
      .eq("date", targetDate)
      .eq("user_id", user.id)
      .not("template_id", "is", null);

    const existingTaskTemplateIds = new Set(
      existingTasks?.map((t) => t.template_id) ?? []
    );

    const targetDayOfWeek = new Date(targetDate + "T00:00:00").getDay();

    const shouldGenerateDaily = (r: { recurrence_type?: string }) => {
      const type = r.recurrence_type ?? "daily";
      if (type === "daily") return true;
      if (type === "weekdays") return targetDayOfWeek >= 1 && targetDayOfWeek <= 5;
      return false;
    };

    const newTasks = dailyRoutines
      .filter((r) => !existingTaskTemplateIds.has(r.id) && shouldGenerateDaily(r))
      .map((r) => ({
        user_id: user.id,
        template_id: r.id,
        section_id: r.section_id,
        date: targetDate,
        title: r.title,
        estimated_minutes: r.estimated_minutes,
        eisenhower_quadrant: r.eisenhower_quadrant ?? null,
        time_block: r.time_block ?? null,
        scheduled_start: r.scheduled_start ?? null,
        scheduled_end: r.scheduled_end ?? null,
        sort_order: r.sort_order,
        status: "pending" as const,
      }));

    if (newTasks.length > 0) {
      await supabase.from("daily_tasks").insert(newTasks);
      generatedCount += newTasks.length;
    }
  }

  // ===== 週次テンプレート → periodic_goals (weekly) =====
  if (weeklyRoutines.length > 0) {
    const weekRange = getWeekRange(targetDate);

    const { data: existingWeeklyGoals } = await supabase
      .from("periodic_goals")
      .select("template_id")
      .eq("period_type", "weekly")
      .eq("period_start", weekRange.start)
      .eq("user_id", user.id)
      .not("template_id", "is", null);

    const existingWeeklyTemplateIds = new Set(
      existingWeeklyGoals?.map((g) => g.template_id) ?? []
    );

    const newWeeklyGoals = weeklyRoutines
      .filter((r) => !existingWeeklyTemplateIds.has(r.id))
      .map((r, i) => ({
        user_id: user.id,
        template_id: r.id,
        title: r.title,
        period_type: "weekly" as const,
        period_start: weekRange.start,
        period_end: weekRange.end,
        sort_order: r.sort_order ?? i,
        status: "pending" as const,
      }));

    if (newWeeklyGoals.length > 0) {
      await supabase.from("periodic_goals").insert(newWeeklyGoals);
      generatedCount += newWeeklyGoals.length;
    }
  }

  // ===== 月次テンプレート → periodic_goals (monthly) =====
  if (monthlyRoutines.length > 0) {
    const monthRange = getMonthRange(targetDate);

    const { data: existingMonthlyGoals } = await supabase
      .from("periodic_goals")
      .select("template_id")
      .eq("period_type", "monthly")
      .eq("period_start", monthRange.start)
      .eq("user_id", user.id)
      .not("template_id", "is", null);

    const existingMonthlyTemplateIds = new Set(
      existingMonthlyGoals?.map((g) => g.template_id) ?? []
    );

    const newMonthlyGoals = monthlyRoutines
      .filter((r) => !existingMonthlyTemplateIds.has(r.id))
      .map((r, i) => ({
        user_id: user.id,
        template_id: r.id,
        title: r.title,
        period_type: "monthly" as const,
        period_start: monthRange.start,
        period_end: monthRange.end,
        sort_order: r.sort_order ?? i,
        status: "pending" as const,
      }));

    if (newMonthlyGoals.length > 0) {
      await supabase.from("periodic_goals").insert(newMonthlyGoals);
      generatedCount += newMonthlyGoals.length;
    }
  }

  return NextResponse.json({
    message: `Generated ${generatedCount} routine tasks/goals`,
    count: generatedCount,
  });
}
