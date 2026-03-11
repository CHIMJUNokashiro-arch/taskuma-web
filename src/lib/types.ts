// アイゼンハワーマトリクス 4象限
export type EisenhowerQuadrant =
  | "urgent_important"
  | "important"
  | "urgent"
  | "other";

export const EISENHOWER_LABELS: Record<EisenhowerQuadrant, string> = {
  urgent_important: "緊急×重要",
  important: "重要",
  urgent: "緊急",
  other: "その他",
};

export const EISENHOWER_COLORS: Record<
  EisenhowerQuadrant,
  { bg: string; text: string; border: string; badge: string }
> = {
  urgent_important: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-300",
  },
  important: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300",
  },
  urgent: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/20 text-yellow-300",
  },
  other: {
    bg: "bg-gray-500/15",
    text: "text-gray-400",
    border: "border-gray-500/30",
    badge: "bg-gray-500/20 text-gray-300",
  },
};

export const EISENHOWER_QUADRANTS: EisenhowerQuadrant[] = [
  "urgent_important",
  "important",
  "urgent",
  "other",
];

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
  eisenhower_quadrant: EisenhowerQuadrant | null;
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
  eisenhower_quadrant: EisenhowerQuadrant | null;
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
