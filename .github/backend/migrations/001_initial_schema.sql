-- ============================================================
-- Migration 001: Initial Schema
-- Collaborative Platform — Supabase Database
-- Run this in the Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- PROFILES: Extended user data beyond auth.users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  is_guest      BOOLEAN DEFAULT FALSE,
  bio           TEXT,
  total_rooms   INT DEFAULT 0,
  problems_solved INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    COALESCE((NEW.raw_user_meta_data->>'is_anonymous')::boolean, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------------------------------------------------------
-- ROOMS: Persistent room state
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  owner_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  language      TEXT DEFAULT 'javascript',
  code          TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT TRUE,
  is_paused     BOOLEAN DEFAULT FALSE,
  max_users     INT DEFAULT 4,
  current_problem_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- -------------------------------------------------------
-- ROOM MEMBERS: Track who is/was in each room
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username  TEXT NOT NULL,
  role      TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at   TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

-- -------------------------------------------------------
-- CHAT MESSAGES: Persist room chat
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- CODE SNAPSHOTS: Periodic saves of room code
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_snapshots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  code       TEXT NOT NULL,
  language   TEXT NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- SAVED SNIPPETS: User's personal saved code
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  code        TEXT NOT NULL,
  language    TEXT NOT NULL,
  is_public   BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- SOLVED PROBLEMS: Per-user solved DSA problems
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS solved_problems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  problem_id  TEXT NOT NULL,
  room_id     TEXT,
  solved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, problem_id)
);

-- -------------------------------------------------------
-- INDEXES for performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_room ON code_snapshots(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snippets_user ON saved_snippets(user_id);
CREATE INDEX IF NOT EXISTS idx_solved_user ON solved_problems(user_id);
