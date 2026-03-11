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
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // Get stored tokens
  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "Google Calendar not connected" },
      { status: 400 }
    );
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

    // タイムゾーンを考慮した日の境界を設定
    // フロントからtimezoneが来ればそれを使用、なければAsia/Tokyoをデフォルト
    const tz = timezone || "Asia/Tokyo";

    // RFC3339形式でタイムゾーン付きの時刻を生成
    // Google Calendar APIはRFC3339を受け付ける
    const timeMin = `${date}T00:00:00`;
    const timeMax = `${date}T23:59:59`;

    // タイムゾーンオフセットを計算
    const getOffset = (dateStr: string, tzName: string) => {
      const d = new Date(dateStr);
      const utc = d.toLocaleString("en-US", { timeZone: "UTC" });
      const local = d.toLocaleString("en-US", { timeZone: tzName });
      const diff = new Date(local).getTime() - new Date(utc).getTime();
      const hours = Math.floor(Math.abs(diff) / 3600000);
      const minutes = Math.floor((Math.abs(diff) % 3600000) / 60000);
      const sign = diff >= 0 ? "+" : "-";
      return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };

    const offset = getOffset(`${date}T12:00:00Z`, tz);
    const timeMinTz = `${timeMin}${offset}`;
    const timeMaxTz = `${timeMax}${offset}`;

    // Get all calendars the user has selected (visible in Google Calendar UI)
    const { data: calendarList } = await calendar.calendarList.list();
    const selectedCalendars = (calendarList.items ?? []).filter(
      (cal) => cal.selected && cal.id
    );

    // Fetch events from all selected calendars
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTimedEvents: any[] = [];
    const calendarDetails: string[] = [];
    const errors: string[] = [];

    for (const cal of selectedCalendars) {
      try {
        const { data: eventsData } = await calendar.events.list({
          calendarId: cal.id!,
          timeMin: timeMinTz,
          timeMax: timeMaxTz,
          singleEvents: true,
          orderBy: "startTime",
          timeZone: tz,
        });

        const events = eventsData.items ?? [];
        // Filter: only timed events (skip all-day events)
        const timed = events.filter(
          (e) => e.start?.dateTime && e.end?.dateTime
        );
        allTimedEvents.push(...timed);
        calendarDetails.push(
          `${cal.summary ?? cal.id}: ${events.length}件中${timed.length}件`
        );
      } catch (calError) {
        const errMsg = calError instanceof Error ? calError.message : String(calError);
        errors.push(`${cal.summary ?? cal.id}: ${errMsg}`);
        console.warn(`Failed to fetch calendar ${cal.id}:`, calError);
      }
    }

    // Deduplicate by event id (same event can appear in multiple calendars)
    const seenEventIds = new Set<string>();
    const timedEvents = allTimedEvents.filter((e) => {
      if (!e.id || seenEventIds.has(e.id)) return false;
      seenEventIds.add(e.id);
      return true;
    });

    // Get existing google_event_ids for this date to skip duplicates
    const { data: existingTasks } = await supabase
      .from("daily_tasks")
      .select("google_event_id")
      .eq("user_id", user.id)
      .eq("date", date)
      .not("google_event_id", "is", null);

    const existingEventIds = new Set(
      (existingTasks ?? []).map((t) => t.google_event_id)
    );

    // Get max sort_order
    const { data: allTasks } = await supabase
      .from("daily_tasks")
      .select("sort_order")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("sort_order", { ascending: false })
      .limit(1);

    let nextSortOrder = ((allTasks?.[0]?.sort_order as number) ?? 0) + 1;

    let imported = 0;
    let skipped = 0;
    const skippedNames: string[] = [];

    for (const event of timedEvents) {
      if (!event.id || existingEventIds.has(event.id)) {
        skipped++;
        skippedNames.push(event.summary ?? "(no title)");
        continue;
      }

      const start = new Date(event.start!.dateTime!);
      const end = new Date(event.end!.dateTime!);
      const durationMinutes = Math.round(
        (end.getTime() - start.getTime()) / 60000
      );

      await supabase.from("daily_tasks").insert({
        user_id: user.id,
        date,
        title: event.summary ?? "（無題のイベント）",
        estimated_minutes: durationMinutes,
        memo: event.description?.substring(0, 500) ?? null,
        google_event_id: event.id,
        sort_order: nextSortOrder++,
        status: "pending",
      });

      imported++;
    }

    const message = imported > 0
      ? `${imported}件インポート${skipped > 0 ? `（${skipped}件は既存のためスキップ）` : ""}`
      : skipped > 0
        ? `新規イベントなし（${skipped}件は取込済み）`
        : `イベントが見つかりませんでした`;

    return NextResponse.json({
      imported,
      skipped,
      total: timedEvents.length,
      calendars: selectedCalendars.length,
      message,
      debug: {
        timeRange: `${timeMinTz} ~ ${timeMaxTz}`,
        calendarDetails,
        skippedNames: skippedNames.length > 0 ? skippedNames : undefined,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Google Calendar import error:", error);
    return NextResponse.json(
      { error: "カレンダーの取得に失敗しました" },
      { status: 500 }
    );
  }
}
