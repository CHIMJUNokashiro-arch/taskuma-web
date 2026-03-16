// タイムブロック（3時間ごと）
export type TimeBlock = "morning" | "am" | "afternoon" | "evening" | "night";

export const TIME_BLOCKS: TimeBlock[] = [
  "morning",
  "am",
  "afternoon",
  "evening",
  "night",
];

export const TIME_BLOCK_LABELS: Record<TimeBlock, string> = {
  morning: "朝 6-9",
  am: "午前 9-12",
  afternoon: "午後 12-15",
  evening: "夕方 15-18",
  night: "夜 18-21",
};

export const TIME_BLOCK_COLORS: Record<
  TimeBlock,
  { bg: string; text: string; border: string; badge: string }
> = {
  morning: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-300",
  },
  am: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/30",
    badge: "bg-sky-500/20 text-sky-300",
  },
  afternoon: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300",
  },
  evening: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/30",
    badge: "bg-purple-500/20 text-purple-300",
  },
  night: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    badge: "bg-indigo-500/20 text-indigo-300",
  },
};

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
  time_block: TimeBlock | null;
  scheduled_start: string | null; // HH:MM format
  scheduled_end: string | null;   // HH:MM format
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
  time_block: TimeBlock | null;
  scheduled_start: string | null; // HH:MM format
  scheduled_end: string | null;   // HH:MM format
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
