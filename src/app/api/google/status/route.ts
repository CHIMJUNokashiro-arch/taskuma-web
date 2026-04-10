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

  // トークンの有効性を検証
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

    // リフレッシュを試みてトークンが有効かチェック
    // (getAccessToken はトークンが有効ならそのまま返し、期限切れならリフレッシュする)
    const { token: accessToken } = await oauth2Client.getAccessToken();

    if (accessToken) {
      // リフレッシュされた場合はDBを更新
      const creds = oauth2Client.credentials;
      if (creds.access_token !== token.access_token) {
        await supabase
          .from("google_tokens")
          .update({
            access_token: creds.access_token!,
            token_expires_at: creds.expiry_date
              ? new Date(creds.expiry_date).toISOString()
              : token.token_expires_at,
            ...(creds.refresh_token ? { refresh_token: creds.refresh_token } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }
    } else {
      valid = false;
    }
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
