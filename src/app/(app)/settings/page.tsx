import { createClient } from "@/lib/supabase/server";
import SettingsView from "@/components/SettingsView";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .order("sort_order", { ascending: true });

  return <SettingsView sections={sections ?? []} />;
}
