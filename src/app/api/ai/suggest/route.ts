import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 過去7日間のログを取得
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fromDate = sevenDaysAgo.toISOString().split("T")[0];

  const { data: recentTasks } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", fromDate)
    .order("date", { ascending: false });

  // セクション情報を取得
  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const sectionMap = new Map(
    (sections ?? []).map((s) => [s.id, s.name])
  );

  const logsText =
    recentTasks
      ?.map(
        (t) =>
          `${t.date} | ${sectionMap.get(t.section_id) ?? "未分類"} | ${t.title} | 見積${t.estimated_minutes}分 | 実績${t.actual_minutes ?? "-"}分 | ${t.status}`
      )
      .join("\n") ?? "ログなし";

  const sectionNames = (sections ?? []).map((s) => s.name).join("、");

  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `あなたはタスク管理の専門家です。
ユーザーの過去1週間のタスク実行ログを分析し、今日やるべきタスクリストを提案してください。

以下の点を考慮してください：
- よく実行されているルーティンタスク
- 最近できていなかったタスク
- 1日の合計見積もり時間が8時間(480分)以内に収まるようにする
- セクション（${sectionNames || "朝・午前・午後・夜"}）を意識した配置

過去1週間のログ:
${logsText}

出力は以下のJSON形式で返してください（JSONのみ、説明不要）:
{
  "tasks": [
    {
      "title": "タスク名",
      "estimated_minutes": 30,
      "section": "セクション名"
    }
  ],
  "summary": "提案の要約（日本語で1-2文）"
}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    // JSONを抽出（コードブロック内にある場合も考慮）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: responseText },
      { status: 500 }
    );
  }
}
