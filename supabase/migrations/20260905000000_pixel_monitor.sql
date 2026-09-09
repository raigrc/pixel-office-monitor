-- Pixel Office Monitor — floors + cubicles (Supabase-ready, flag NEXT_PUBLIC_USE_SUPABASE=1)
-- MVP defaults to in-memory Map; this migration prepares cloud persistence.
-- Tables mirror monitor-store.ts: Floor = sessionID + title + project + status + updatedAt
-- Cubicle = (sessionID, agent) + kind + status + since + lastTool + prompt + todos

-- Enable pgcrypto for gen_random_uuid if not already
create extension if not exists "pgcrypto";

-- Floors: one row per sessionID (office floor)
create table if not exists floors (
  session_id text primary key,
  title text,
  project text not null default 'unknown',
  status text not null check (status in ('working','idle')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Cubicles: one per (sessionID, agent)
create table if not exists cubicles (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references floors(session_id) on delete cascade,
  agent text not null,
  kind text not null check (kind in (
    'subtask.start','subtask.end','session.busy','session.idle',
    'session.created','tool.before','tool.after','todo.updated'
  )),
  status text not null check (status in ('working','idle')),
  since timestamptz not null default now(),
  last_tool text,
  prompt text check (char_length(prompt) <= 200),
  todos jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cubicles_session_agent_unique unique (session_id, agent)
);

-- Indexes for read patterns: getState() sorted by updated_at desc, plus lookups by status
create index if not exists idx_floors_updated_at on floors (updated_at desc);
create index if not exists idx_floors_status on floors (status);
create index if not exists idx_cubicles_session_id on cubicles (session_id);
create index if not exists idx_cubicles_agent on cubicles (agent);
create index if not exists idx_cubicles_status on cubicles (status);
create index if not exists idx_cubicles_since on cubicles (since);

-- updated_at trigger helper (reuse if exists)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_floors_updated_at on floors;
create trigger trg_floors_updated_at
  before update on floors
  for each row execute function set_updated_at();

drop trigger if exists trg_cubicles_updated_at on cubicles;
create trigger trg_cubicles_updated_at
  before update on cubicles
  for each row execute function set_updated_at();

-- RLS: enable but allow service_role full access; anon/auth read only if needed for dashboard
alter table floors enable row level security;
alter table cubicles enable row level security;

-- Drop existing policies if re-run
drop policy if exists "Service role full access floors" on floors;
drop policy if exists "Anon can read floors" on floors;
drop policy if exists "Service role full access cubicles" on cubicles;
drop policy if exists "Anon can read cubicles" on cubicles;

-- Service role bypass: Supabase service_role bypasses RLS by default, but we create explicit permissive policies for completeness
create policy "Service role full access floors"
  on floors for all
  using (true)
  with check (true);

create policy "Anon can read floors"
  on floors for select
  using (true);

create policy "Service role full access cubicles"
  on cubicles for all
  using (true)
  with check (true);

create policy "Anon can read cubicles"
  on cubicles for select
  using (true);

-- Optional: prune helper — delete idle floors older than 24h (called via cron or store.prune)
-- Example manual prune:
-- delete from floors where status='idle' and updated_at < now() - interval '24 hours';
-- delete from cubicles where status='idle' and since < now() - interval '24 hours';

comment on table floors is 'Pixel Office Monitor: one floor per sessionID';
comment on table cubicles is 'Pixel Office Monitor: one cubicle per (sessionID, agent)';
