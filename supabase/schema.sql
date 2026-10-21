-- Travember schema. Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.
--
-- Clients never read these tables directly; all access goes through the Spring Boot API,
-- which connects as the `postgres` role. RLS is enabled with no policies so the public
-- Supabase Data API (anon / publishable key) cannot read or write them.

create table if not exists public.destinations (
    id              uuid primary key default gen_random_uuid(),
    owner_id        uuid not null references auth.users (id) on delete cascade,
    title           text not null,
    country         text,
    summary         text,
    cover_image_url text,
    start_date      date,
    end_date        date,
    created_at      timestamptz not null default now()
);

create table if not exists public.places (
    id             uuid primary key default gen_random_uuid(),
    destination_id uuid not null references public.destinations (id) on delete cascade,
    name           text not null,
    note           text,
    latitude       double precision not null check (latitude between -90 and 90),
    longitude      double precision not null check (longitude between -180 and 180),
    visited_on     date,
    created_at     timestamptz not null default now()
);

create index if not exists places_destination_id_idx on public.places (destination_id);
create index if not exists destinations_owner_id_idx on public.destinations (owner_id);

alter table public.destinations enable row level security;
alter table public.places enable row level security;
