import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: token } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!token) {
    return NextResponse.json({ connected: false, email: null, valid: false });
  }

  // トークンの有効性を実際のAPI呼び出しで検証
  let valid = true;
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: new Date(token.token_expires_at).getTime(),
    });

    // トークンリフレッシュのコールバック
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

    // 実際にGoogle Calendar APIを叩いて検証（軽量なリスト取得）
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.calendarList.list({ maxResults: 1 });
  } catch (e) {
    console.warn("Google token validation failed:", e);
    valid = false;
  }

  return NextResponse.json({
    connected: !!token,
    email: token?.google_email ?? null,
    valid,
  });
}
