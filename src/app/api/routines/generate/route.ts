import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  // 既に当日分が生成済みかチェック
  const { data: existing } = await supabase
    .from("daily_tasks")
    .select("template_id")
    .eq("date", targetDate)
    .eq("user_id", user.id);

  const existingTemplateIds = new Set(
    existing?.map((t) => t.template_id) ?? []
  );

  // 未生成のルーティンのみ追加
  const newTasks = routines
    .filter((r) => !existingTemplateIds.has(r.id))
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
  }

  return NextResponse.json({
    message: `Generated ${newTasks.length} routine tasks`,
    count: newTasks.length,
  });
}
