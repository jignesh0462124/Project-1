-- ============================================================
-- Migration: Initial Schema
-- Collaborative Platform - Supabase Database
-- Generated with Supabase CLI
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- PROFILES: Extended user data beyond auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  is_guest boolean default false,
  bio text,
  total_rooms int default 0,
  problems_solved int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'),
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- ROOMS: Persistent room state
-- ------------------------------------------------------------
create table if not exists public.rooms (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  owner_socket_id text,
  language text default 'javascript',
  code text default '',
  is_active boolean default true,
  is_paused boolean default false,
  max_users int default 4,
  current_problem_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- ------------------------------------------------------------
-- ROOM MEMBERS: Track who is/was in each room
-- user_id is nullable so existing no-login socket guests can persist.
-- ------------------------------------------------------------
create table if not exists public.room_members (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  socket_id text,
  username text not null,
  role text default 'member' check (role in ('owner', 'member')),
  is_active boolean default true,
  is_paused boolean default false,
  joined_at timestamptz default now(),
  left_at timestamptz,
  constraint room_members_identity_present check (user_id is not null or socket_id is not null),
  unique(room_id, user_id),
  unique(room_id, socket_id)
);

-- ------------------------------------------------------------
-- CHAT MESSAGES: Persist room chat
-- ------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  socket_id text,
  username text not null,
  message text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- CODE SNAPSHOTS: Periodic saves of room code
-- ------------------------------------------------------------
create table if not exists public.code_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  socket_id text,
  code text not null,
  language text not null,
  label text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- SAVED SNIPPETS: User's personal saved code
-- ------------------------------------------------------------
create table if not exists public.saved_snippets (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  code text not null,
  language text not null,
  is_public boolean default false,
  share_token text unique default encode(extensions.gen_random_bytes(8), 'hex'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- SOLVED PROBLEMS: Per-user solved DSA problems
-- ------------------------------------------------------------
create table if not exists public.solved_problems (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  socket_id text,
  username text,
  problem_id text not null,
  room_id text references public.rooms(id) on delete set null,
  solved_at timestamptz default now(),
  constraint solved_problems_identity_present check (user_id is not null or socket_id is not null),
  unique(user_id, problem_id),
  unique(socket_id, problem_id)
);

-- ------------------------------------------------------------
-- updated_at helper
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

drop trigger if exists snippets_set_updated_at on public.saved_snippets;
create trigger snippets_set_updated_at
  before update on public.saved_snippets
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Indexes for performance
-- ------------------------------------------------------------
create index if not exists idx_rooms_is_active on public.rooms(is_active);
create index if not exists idx_rooms_expires_at on public.rooms(expires_at);
create index if not exists idx_room_members_room_active on public.room_members(room_id, is_active);
create index if not exists idx_room_members_user on public.room_members(user_id);
create index if not exists idx_room_members_socket on public.room_members(socket_id);
create index if not exists idx_chat_room_created on public.chat_messages(room_id, created_at desc);
create index if not exists idx_snapshots_room_created on public.code_snapshots(room_id, created_at desc);
create index if not exists idx_snippets_user on public.saved_snippets(user_id);
create index if not exists idx_solved_user on public.solved_problems(user_id);
