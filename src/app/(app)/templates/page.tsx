import { createClient } from "@/lib/supabase/server";
import TemplatesView from "@/components/TemplatesView";
import type { TaskTemplate, Section } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const [templatesRes, sectionsRes] = await Promise.all([
    supabase
      .from("task_templates")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("sections")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const templates: TaskTemplate[] = templatesRes.data ?? [];
  const sections: Section[] = sectionsRes.data ?? [];

  return <TemplatesView initialTemplates={templates} sections={sections} />;
}
