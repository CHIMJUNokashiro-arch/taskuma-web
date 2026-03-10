export type Section = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type TaskTemplate = {
  id: string;
  user_id: string;
  section_id: string | null;
  title: string;
  estimated_minutes: number;
  is_routine: boolean;
  sort_order: number;
  created_at: string;
};

export type DailyTask = {
  id: string;
  user_id: string;
  template_id: string | null;
  section_id: string | null;
  date: string;
  title: string;
  estimated_minutes: number;
  actual_minutes: number | null;
  started_at: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "done";
  memo: string | null;
  sort_order: number;
  google_event_id: string | null;
  created_at: string;
};

export type GoogleToken = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  google_email: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithSection = DailyTask & {
  section?: Section;
};
