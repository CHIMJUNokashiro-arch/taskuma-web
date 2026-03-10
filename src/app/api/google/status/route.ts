import { NextResponse } from "next/server";
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
    .select("google_email, created_at")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    connected: !!token,
    email: token?.google_email ?? null,
  });
}
