# Travember

A travel book on a map. Every trip is a **chapter**, and every place you went is a numbered **pin**.
Anyone can read the book; signed-in users write their own chapters and pin places on them.

```
frontend/   React + Vite web app (Leaflet / OpenStreetMap maps, Supabase Auth)
backend/    Spring Boot 4 API (Java 25), the only thing that talks to the database
supabase/   Database schema
```

The browser signs in with Supabase Auth and sends the access token to the API. The API verifies it
against your project's public keys and stores data in Supabase Postgres. The tables have RLS turned
on with no policies, so the public Supabase key can't read or write them directly.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste [supabase/schema.sql](supabase/schema.sql) and run it.
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
| GET | `/api/destinations` | public: all chapters with places, in book order |
| GET | `/api/destinations/{id}` | public |
| POST | `/api/destinations` | signed in |
| PUT / DELETE | `/api/destinations/{id}` | chapter author |
| POST | `/api/destinations/{id}/places` | chapter author |
| PUT / DELETE | `/api/places/{id}` | chapter author |

Chapters are ordered by start date; undated trips come last. Places within a chapter are ordered
by visit date, and that order is the pin numbering and the dashed route on the map.

## Notes

- Place search uses OpenStreetMap's free [Nominatim](https://nominatim.org/) service, and only on
  an explicit search, as its usage policy requires. Clicking the map works without it.
- Cover images are plain URLs; there is no upload yet.
