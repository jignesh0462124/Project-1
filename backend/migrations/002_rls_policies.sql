-- ============================================================
-- Migration 002: Row Level Security Policies
-- Collaborative Platform — Supabase RLS
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- -------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (for displaying usernames in rooms)
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (TRUE);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- -------------------------------------------------------
-- ROOMS
-- -------------------------------------------------------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (including guests) can read active rooms
CREATE POLICY "rooms_select_active"
  ON rooms FOR SELECT
  USING (is_active = TRUE);

-- Any authenticated user can create a room
CREATE POLICY "rooms_insert_auth"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only the room owner can update the room
CREATE POLICY "rooms_update_owner"
  ON rooms FOR UPDATE
  USING (auth.uid() = owner_id);

-- Only the room owner can delete/close the room
CREATE POLICY "rooms_delete_owner"
  ON rooms FOR DELETE
  USING (auth.uid() = owner_id);

-- -------------------------------------------------------
-- ROOM MEMBERS
-- -------------------------------------------------------
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read room member lists
CREATE POLICY "room_members_select_public"
  ON room_members FOR SELECT
  USING (TRUE);

-- Authenticated users can join rooms
CREATE POLICY "room_members_insert_auth"
  ON room_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Users can update their own membership (e.g., mark as left)
CREATE POLICY "room_members_update_own"
  ON room_members FOR UPDATE
  USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- CHAT MESSAGES
-- -------------------------------------------------------
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read chat in a room (room-level filter handled in app)
CREATE POLICY "chat_select_public"
  ON chat_messages FOR SELECT
  USING (TRUE);

-- Authenticated users can send messages
CREATE POLICY "chat_insert_auth"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can delete their own messages
CREATE POLICY "chat_delete_own"
  ON chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- CODE SNAPSHOTS
-- -------------------------------------------------------
ALTER TABLE code_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read snapshots (for room history)
CREATE POLICY "snapshots_select_public"
  ON code_snapshots FOR SELECT
  USING (TRUE);

-- Authenticated users can create snapshots
CREATE POLICY "snapshots_insert_auth"
  ON code_snapshots FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- SAVED SNIPPETS
-- -------------------------------------------------------
ALTER TABLE saved_snippets ENABLE ROW LEVEL SECURITY;

-- Users can read their own snippets, plus any public ones
CREATE POLICY "snippets_select"
  ON saved_snippets FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

-- Users can only create snippets for themselves
CREATE POLICY "snippets_insert_own"
  ON saved_snippets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own snippets
CREATE POLICY "snippets_update_own"
  ON saved_snippets FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own snippets
CREATE POLICY "snippets_delete_own"
  ON saved_snippets FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- SOLVED PROBLEMS
-- -------------------------------------------------------
ALTER TABLE solved_problems ENABLE ROW LEVEL SECURITY;

-- Users can view their own solved problems
CREATE POLICY "solved_select_own"
  ON solved_problems FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark problems as solved for themselves
CREATE POLICY "solved_insert_own"
  ON solved_problems FOR INSERT
  WITH CHECK (auth.uid() = user_id);
