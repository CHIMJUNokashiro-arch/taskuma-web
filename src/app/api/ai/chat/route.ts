import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, history } = await request.json();

  // 今日のタスクを取得
  const today = new Date().toISOString().split("T")[0];
  const { data: todayTasks } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("sort_order", { ascending: true });

  const tasksContext =
    todayTasks
      ?.map(
        (t) =>
          `- ${t.title} (${t.estimated_minutes}分, ${t.status === "done" ? "完了" : t.status === "in_progress" ? "実行中" : "未着手"})`
      )
      .join("\n") ?? "タスクなし";

  const anthropic = new Anthropic();

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []),
    { role: "user" as const, content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `あなたはタスク管理のアシスタントです。ユーザーのタスク整理を手助けしてください。
現在の今日のタスク:
${tasksContext}

簡潔に、親しみやすく回答してください。`,
    messages,
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ response: responseText });
}
