-- Travember schema. Run it in the Supabase dashboard: SQL Editor -> New query -> Run.
-- Every statement is idempotent, so re-run the whole file after pulling schema changes.
--
-- Clients never read these tables directly; all access goes through the Spring Boot API,
-- which connects as the `postgres` role. RLS is enabled with no policies so the public
-- Supabase Data API (anon / publishable key) cannot read or write them.

-- A travel book. Each user can write any number of them; chapters (destinations) belong to one book.
create table if not exists public.books (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    description text,
    -- Null means "no cover chosen": readers see the book's first photo, or else a plain designed cover.
    cover_url   text,
    -- Copied from the author's token whenever they save the book, since readers can't read auth.users.
    author_name text not null,
    created_at  timestamptz not null default now()
);

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

-- A page's photos and videos, in display order. The files themselves live in the page-media bucket.
create table if not exists public.place_media (
    place_id uuid    not null references public.places (id) on delete cascade,
    position integer not null,
    kind     text    not null check (kind in ('image', 'video')),
    url      text    not null,
    primary key (place_id, position)
);

create table if not exists public.place_likes (
    place_id   uuid        not null references public.places (id) on delete cascade,
    user_id    uuid        not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (place_id, user_id)
);

create table if not exists public.place_comments (
    id          uuid primary key default gen_random_uuid(),
    place_id    uuid        not null references public.places (id) on delete cascade,
    author_id   uuid        not null references auth.users (id) on delete cascade,
    author_name text        not null,
    body        text        not null,
    created_at  timestamptz not null default now()
);

-- Chapters written before books existed: give each of those authors one book to hold them.
alter table public.destinations add column if not exists book_id uuid references public.books (id) on delete cascade;

insert into public.books (owner_id, title, author_name)
select distinct d.owner_id, 'My travels',
       coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), 'Traveller')
from public.destinations d
join auth.users u on u.id = d.owner_id
where d.book_id is null
  and not exists (select 1 from public.books b where b.owner_id = d.owner_id);

update public.destinations d
set book_id = (select b.id from public.books b where b.owner_id = d.owner_id order by b.created_at limit 1)
where d.book_id is null;

alter table public.destinations alter column book_id set not null;

create index if not exists places_destination_id_idx on public.places (destination_id);
create index if not exists destinations_owner_id_idx on public.destinations (owner_id);
create index if not exists destinations_book_id_idx on public.destinations (book_id);
create index if not exists books_owner_id_idx on public.books (owner_id);
create index if not exists place_likes_user_id_idx on public.place_likes (user_id);
create index if not exists place_comments_place_id_idx on public.place_comments (place_id, created_at);

alter table public.books enable row level security;
alter table public.destinations enable row level security;
alter table public.places enable row level security;
alter table public.place_media enable row level security;
alter table public.place_likes enable row level security;
alter table public.place_comments enable row level security;

-- Photos and videos are uploaded by the browser straight to Storage (the API never proxies files).
-- Anyone can view them; signed-in users can only upload into a folder named after their own user id,
-- and the API only accepts media URLs that point into the page author's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-media', 'page-media', true, 52428800, array ['image/*', 'video/*'])
on conflict (id) do nothing;

drop policy if exists "page-media: upload to own folder" on storage.objects;
create policy "page-media: upload to own folder" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'page-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
