import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date, timezone } = await request.json();

  if (!date) {
    return NextResponse.json(
      { error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Google未接続なら静かに終了
  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "Googleカレンダー未接続です" },
      { status: 400 }
    );
  }

  // 指定日の完了タスクでgoogle_event_idが未設定のものを取得
  const { data: tasks } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("status", "done")
    .is("google_event_id", null)
    .order("sort_order", { ascending: true });

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({
      exported: 0,
      message: "エクスポート対象のタスクがありません",
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: new Date(tokenRow.token_expires_at).getTime(),
  });

  // Auto-refresh token if expired
  oauth2Client.on("tokens", async (tokens) => {
    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (tokens.access_token) updates.access_token = tokens.access_token;
    if (tokens.expiry_date)
      updates.token_expires_at = new Date(tokens.expiry_date).toISOString();
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

    await supabase
      .from("google_tokens")
      .update(updates)
      .eq("user_id", user.id);
  });

  // トークンが期限切れの場合、事前にリフレッシュ
  const now = Date.now();
  const expiryDate = new Date(tokenRow.token_expires_at).getTime();
  if (expiryDate < now + 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      return NextResponse.json(
        { error: "Googleトークンの更新に失敗しました。設定で再接続してください。" },
        { status: 401 }
      );
    }
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const tz = timezone || "Asia/Tokyo";

  let exported = 0;
  let failed = 0;
  let needsReconnect = false;

  for (const task of tasks) {
    try {
      if (!task.completed_at) {
        failed++;
        continue;
      }

      const endTime = new Date(task.completed_at);
      let startTime: Date;

      if (task.started_at) {
        startTime = new Date(task.started_at);
      } else {
        const durationMs = (task.actual_minutes ?? 30) * 60000;
        startTime = new Date(endTime.getTime() - durationMs);
      }

      const event = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: task.title || "（無題のタスク）",
          description: "Taskumaで記録",
          start: {
            dateTime: startTime.toISOString(),
            timeZone: tz,
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: tz,
          },
        },
      });

      if (event.data.id) {
        await supabase
          .from("daily_tasks")
          .update({ google_event_id: event.data.id })
          .eq("id", task.id);
        exported++;
      }
    } catch (error: unknown) {
      console.error(`Export failed for task ${task.id}:`, error);
      // 権限不足 (403) or 認証エラー (401) → 再接続が必要
      const status = (error as { code?: number })?.code ??
                     (error as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 401) {
        needsReconnect = true;
        break; // 権限エラーは全タスクに影響するので中断
      }
      failed++;
    }
  }

  if (needsReconnect) {
    return NextResponse.json(
      { error: "Googleカレンダーの書き込み権限がありません。設定画面でGoogleを一度切断→再接続してください。" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    exported,
    failed,
    message: `${exported}件のタスクをGoogleカレンダーにエクスポートしました${failed > 0 ? `（${failed}件失敗）` : ""}`,
  });
}
