-- Minimal schema based on current frontend needs (no FID)

-- Users: only address, display name and avatar are required in UI
CREATE TABLE IF NOT EXISTS public.users (
  address TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks: mirrors frontend Task shape (excluding UI-only isEditing)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY, -- frontend uses Date.now(); store as text to keep flexibility
  user_address TEXT REFERENCES public.users(address) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  pomodoros INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  pomodoro_paused_at INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preferences: filter/sort/activeTag used in UI
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_address TEXT PRIMARY KEY REFERENCES public.users(address) ON DELETE CASCADE,
  filter TEXT CHECK (filter IN ('active','completed','all')) DEFAULT 'active',
  sort TEXT CHECK (sort IN ('creation','dueDate','priority')) DEFAULT 'creation',
  active_tag TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_address ON public.tasks(user_address);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
