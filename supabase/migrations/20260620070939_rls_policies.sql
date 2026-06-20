-- ============================================================
-- Migration: Row Level Security Policies
-- Collaborative Platform - Supabase RLS
-- Run after initial schema
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ------------------------------------------------------------
-- ROOMS
-- ------------------------------------------------------------
alter table public.rooms enable row level security;

drop policy if exists rooms_select_active on public.rooms;
create policy rooms_select_active
  on public.rooms for select
  to authenticated
  using (
    is_active = true
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1
        from public.room_members rm
        where rm.room_id = rooms.id
          and rm.user_id = (select auth.uid())
          and rm.is_active = true
      )
    )
  );

drop policy if exists rooms_insert_auth on public.rooms;
create policy rooms_insert_auth
  on public.rooms for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists rooms_update_owner on public.rooms;
create policy rooms_update_owner
  on public.rooms for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists rooms_delete_owner on public.rooms;
create policy rooms_delete_owner
  on public.rooms for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ------------------------------------------------------------
-- ROOM MEMBERS
-- ------------------------------------------------------------
alter table public.room_members enable row level security;

drop policy if exists room_members_select_public on public.room_members;
create policy room_members_select_public
  on public.room_members for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists room_members_insert_auth on public.room_members;
create policy room_members_insert_auth
  on public.room_members for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists room_members_update_own on public.room_members;
create policy room_members_update_own
  on public.room_members for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- CHAT MESSAGES
-- ------------------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists chat_select_public on public.chat_messages;
create policy chat_select_public
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = chat_messages.room_id
        and rm.user_id = (select auth.uid())
        and rm.is_active = true
    )
  );

drop policy if exists chat_insert_auth on public.chat_messages;
create policy chat_insert_auth
  on public.chat_messages for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_delete_own on public.chat_messages;
create policy chat_delete_own
  on public.chat_messages for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- CODE SNAPSHOTS
-- ------------------------------------------------------------
alter table public.code_snapshots enable row level security;

drop policy if exists snapshots_select_public on public.code_snapshots;
create policy snapshots_select_public
  on public.code_snapshots for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = code_snapshots.room_id
        and rm.user_id = (select auth.uid())
        and rm.is_active = true
    )
  );

drop policy if exists snapshots_insert_auth on public.code_snapshots;
create policy snapshots_insert_auth
  on public.code_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- SAVED SNIPPETS
-- ------------------------------------------------------------
alter table public.saved_snippets enable row level security;

drop policy if exists snippets_select on public.saved_snippets;
create policy snippets_select
  on public.saved_snippets for select
  to authenticated
  using ((select auth.uid()) = user_id or is_public = true);

drop policy if exists snippets_insert_own on public.saved_snippets;
create policy snippets_insert_own
  on public.saved_snippets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists snippets_update_own on public.saved_snippets;
create policy snippets_update_own
  on public.saved_snippets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists snippets_delete_own on public.saved_snippets;
create policy snippets_delete_own
  on public.saved_snippets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- SOLVED PROBLEMS
-- ------------------------------------------------------------
alter table public.solved_problems enable row level security;

drop policy if exists solved_select_own on public.solved_problems;
create policy solved_select_own
  on public.solved_problems for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists solved_insert_own on public.solved_problems;
create policy solved_insert_own
  on public.solved_problems for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
