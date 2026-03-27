-- Supabase schema for Taskuma Web

-- セクション（朝・午前・午後・夜）
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- タスクマスタ（ルーティン定義）
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  estimated_minutes INTEGER DEFAULT 30,
  is_routine BOOLEAN DEFAULT FALSE,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 日次タスク（実際に実行するリスト）
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  estimated_minutes INTEGER DEFAULT 30,
  actual_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  memo TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) Policies
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sections" ON sections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own task_templates" ON task_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily_tasks" ON daily_tasks
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_daily_tasks_user_date ON daily_tasks(user_id, date);
CREATE INDEX idx_daily_tasks_status ON daily_tasks(status);
CREATE INDEX idx_task_templates_user ON task_templates(user_id);
CREATE INDEX idx_sections_user ON sections(user_id);

-- Google Calendar integration
CREATE TABLE google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own google_tokens" ON google_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Google event ID for deduplication
ALTER TABLE daily_tasks ADD COLUMN google_event_id TEXT;

CREATE UNIQUE INDEX idx_daily_tasks_google_event_unique
  ON daily_tasks(user_id, date, google_event_id)
  WHERE google_event_id IS NOT NULL;

-- Eisenhower Matrix quadrant columns
ALTER TABLE daily_tasks ADD COLUMN eisenhower_quadrant TEXT
  CHECK (eisenhower_quadrant IN ('urgent_important', 'important', 'urgent', 'other'));

ALTER TABLE task_templates ADD COLUMN eisenhower_quadrant TEXT
  CHECK (eisenhower_quadrant IN ('urgent_important', 'important', 'urgent', 'other'));

-- Scheduled start/end time (HH:MM format, e.g. '09:00', '10:30')
ALTER TABLE daily_tasks ADD COLUMN scheduled_start TEXT;
ALTER TABLE daily_tasks ADD COLUMN scheduled_end TEXT;

ALTER TABLE task_templates ADD COLUMN scheduled_start TEXT;
ALTER TABLE task_templates ADD COLUMN scheduled_end TEXT;

-- Dismissed flag for soft-delete (prevents routine re-generation after user deletes)
ALTER TABLE daily_tasks ADD COLUMN dismissed BOOLEAN DEFAULT FALSE;

-- Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE daily_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
