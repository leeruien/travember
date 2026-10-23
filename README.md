# Travember

A travel book on a map. Every trip is a **chapter**, and every place you went is a **page**: a numbered
pin with photos, videos and an optional write-up. Anyone can read the book, turning its pages one by
one; signed-in users write their own chapters, and like and comment on anyone's pages. Each chapter, and
each traveller's whole book, has a **journey map** where a plane flies from page to page in date order.

```
frontend/   React + Vite web app (Leaflet / OpenStreetMap maps, Supabase Auth)
backend/    Spring Boot 4 API (Java 25), the only thing that talks to the database
supabase/   Database schema
```

The browser signs in with Supabase Auth and sends the access token to the API. The API verifies it
against your project's public keys and stores data in Supabase Postgres. The tables have RLS turned
on with no policies, so the public Supabase key can't read or write them directly.

Photos and videos are the exception: the browser uploads them straight to the public `page-media`
Storage bucket, into a folder named after the user (Storage policies enforce that), and the API only
accepts media URLs from the page author's own folder.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste [supabase/schema.sql](supabase/schema.sql) and run it. It's
   safe to re-run, and you need to whenever it changes. It also creates the `page-media` bucket.
3. **Authentication → URL Configuration**: add `http://localhost:5173` to the redirect URLs, so the
   sign-up confirmation email links back to the app.

### 2. Backend (Java 25, Maven)

```sh
cd backend
cp .env.example .env   # fill in the project URL and the Session pooler connection details
mvn spring-boot:run    # http://localhost:8080
```

### 3. Frontend (Node 20+)

```sh
cd frontend
cp .env.example .env   # project URL + publishable key; VITE_API_URL defaults to http://localhost:8080
npm install
npm run dev            # http://localhost:5173
```

## API

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/api/destinations` | public: all chapters with their pages, in book order |
| GET | `/api/destinations/{id}` | public |
| POST | `/api/destinations` | signed in |
| PUT / DELETE | `/api/destinations/{id}` | chapter author |
| POST | `/api/destinations/{id}/places` | chapter author: add a page |
| PUT / DELETE | `/api/places/{id}` | chapter author |
| PUT / DELETE | `/api/places/{id}/like` | signed in: like / unlike a page |
| GET | `/api/places/{id}/comments` | public |
| POST | `/api/places/{id}/comments` | signed in |
| DELETE | `/api/comments/{id}` | the comment's author, or the page's author |

Pages are `places` in the API and database (they were pins before they were pages). Each one has a
`media` list, `likeCount`, `commentCount` and `likedByMe`; reads accept an optional access token, and
`likedByMe` is only ever true when one is sent.

Chapters are ordered by start date; undated trips come last. Pages within a chapter are ordered
by visit date, and that order is the pin numbering, the dashed route on the map, and the order the
plane flies on the journey map.

## Notes

- Place search uses OpenStreetMap's free [Nominatim](https://nominatim.org/) service, and only on
  an explicit search, as its usage policy requires. Clicking the map works without it.
- Chapter cover images are still plain URLs; only pages have uploads.
- Uploads are capped at 50 MB per file and 20 per page. Files removed from a page, or uploaded to a
  page that was never saved, stay in Storage; nothing cleans them up yet.
- Comment authors are shown by the name in their Supabase profile, or else the part of their email
  before the @.
