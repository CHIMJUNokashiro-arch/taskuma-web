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

  const { taskId, title, startedAt, completedAt, actualMinutes, timezone } =
    await request.json();

  if (!taskId || !completedAt) {
    return NextResponse.json(
      { error: "taskId and completedAt are required" },
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
    return new NextResponse(null, { status: 204 });
  }

  // 既にgoogle_event_idがあるタスクはスキップ（インポート済みor既エクスポート済み）
  const { data: task } = await supabase
    .from("daily_tasks")
    .select("google_event_id")
    .eq("id", taskId)
    .single();

  if (task?.google_event_id) {
    return NextResponse.json({ skipped: true, reason: "already_exported" });
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

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const tz = timezone || "Asia/Tokyo";

    // 開始・終了時間を決定
    const endTime = new Date(completedAt);
    let startTime: Date;

    if (startedAt) {
      startTime = new Date(startedAt);
    } else {
      // started_atがない場合、completedAt - actualMinutesで計算
      const durationMs = (actualMinutes ?? 30) * 60000;
      startTime = new Date(endTime.getTime() - durationMs);
    }

    // Googleカレンダーにイベント作成
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title || "（無題のタスク）",
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

    // 作成されたイベントIDをタスクに保存
    if (event.data.id) {
      await supabase
        .from("daily_tasks")
        .update({ google_event_id: event.data.id })
        .eq("id", taskId);
    }

    return NextResponse.json({
      exported: true,
      eventId: event.data.id,
    });
  } catch (error) {
    console.error("Google Calendar export error:", error);
    return NextResponse.json(
      { error: "Failed to export to Google Calendar" },
      { status: 500 }
    );
  }
}
