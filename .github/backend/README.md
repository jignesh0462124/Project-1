# Backend — Supabase Integration Layer

This folder contains the planned Supabase-powered backend services, middleware, routes, and database migrations.

> ⚠️ **Status:** Planning phase. Files below are scaffolds — not yet wired into the Express server.

## Folder Structure

```
backend/
  config/
    supabase.js          — Supabase admin client (service role key)
  middleware/
    auth.js              — JWT validation (requireAuth, optionalAuth)
    rateLimit.js         — Per-user and per-IP rate limiting
  routes/
    auth.js              — /api/auth/* endpoints
    rooms.js             — /api/rooms CRUD
    profile.js           — /api/profile endpoints
    snapshots.js         — /api/snapshots save/load
  services/
    roomService.js       — Room persistence logic
    profileService.js    — User profile management
    chatService.js       — Persist chat messages to DB
  migrations/
    001_initial_schema.sql   — All table definitions
    002_rls_policies.sql     — Row Level Security rules
  SUPABASE_AUTH_PLAN.md  — Full integration plan (this folder)
  README.md              — This file
```

## See Full Plan

👉 Read [SUPABASE_AUTH_PLAN.md](./SUPABASE_AUTH_PLAN.md) for the complete integration plan including:
- Auth flow diagrams
- Guest mode implementation
- Full database schema (SQL)
- RLS policies
- Server middleware code
- Environment variables
- Migration steps
