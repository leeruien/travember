# Travember

A shelf of travel books on a map. Each **book** has a cover and a contents page; every trip in it is a
**chapter**, and every place you went is a **page**: a numbered pin with photos, videos and an optional
write-up. Anyone can browse and search the shelf and read any book, turning its pages one by one;
signed-in users write their own books, and like and comment on anyone's pages. Each chapter, each book
and each traveller has a **journey map** where a plane flies from page to page in date order.

A book's cover is the one its author uploaded, else the first photo in the book, else a plain cloth
cover with the title on it. A book can be **private**: then only its author can see it, its chapters
and its pages.

Signed-in users also get a **trip planner**: describe a trip, and an AI agent researches it (real
places, weather for the dates, travel times, and pages other travellers wrote) and drafts a day-by-day
itinerary that can be saved into a book as a chapter.

```
frontend/   React + Vite web app (Leaflet / OpenStreetMap maps, Supabase Auth)
backend/    Spring Boot 4 API (Java 25), the only thing that talks to the database
agent/      The trip planner (Python): a LangGraph ReAct agent on Gemini, with its tools on an MCP server
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

### 4. Trip planner (Python 3.12+, [uv](https://docs.astral.sh/uv/)), optional

```sh
cd agent
cp .env.example .env   # a free Gemini API key, and the same Supabase project URL
uv sync
uv run uvicorn planner.app:app --port 8000
uv run pytest          # offline tests: no API key, network or money needed
```

Get a Gemini API key free at [Google AI Studio](https://aistudio.google.com/apikey). The free tier
limits requests per minute and per day (each plan makes roughly 8 to 15), and Google may use free-tier
prompts and answers to improve its products. Each user is also limited to 10 plans an hour
(`AGENT_PLANS_PER_HOUR`). Without the planner running, the rest of the app works as
normal and "Plan a trip" says it can't reach it.

## The trip planner

```
browser ──POST /plan (Supabase token)──▶ planner/app.py (FastAPI) ──streams progress back (SSE)
                                              │
                                    planner/graph.py (LangGraph)
                    START → agent ⇄ tools → END              agent = Gemini (gemini-flash-lite-latest)
                                              │
                                   MCP client, over stdio
                                              │
                         travel_mcp/server.py (MCP server)
   geocode · weather · places_nearby · travel_time · estimate_flight · travember_pages
       │         │            │              │                              │
   Nominatim  Open-Meteo   Overpass        OSRM                     the Travember API
```

- **The ReAct loop** is a LangGraph state graph written out by hand: the `agent` node asks the model
  what to do next; the `tools` node runs the tools it asked for (in parallel) through MCP and feeds the
  results back. The model hands in the plan by calling a `submit_itinerary` function, whose arguments
  are checked against the itinerary JSON schema; if they don't fit, the problems go back to the model
  to fix. Blocked requests, answers cut off by the token limit, and runaway loops (over 30 turns) end
  in `fail`.
- **Gemini** is called through Google's official `google-genai` SDK
  ([planner/gemini.py](agent/planner/gemini.py)), with function calling in `ANY` mode so every turn is
  a tool call and the plan always ends with `submit_itinerary`. The loop itself only knows a small
  `Model` interface, so another model could be swapped in by writing one more adapter. Tool inputs are
  checked against each tool's full schema before anything runs.
- **The tools** are an ordinary MCP server, so any MCP client can use them, not only this agent; for
  example, `claude mcp add travember-travel -- uv --directory agent run python -m travel_mcp.server`
  adds them to Claude Code. All of them use free services that need no key. `estimate_flight` works
  from distance alone: it doesn't know real schedules or prices.
- **Other travellers' pages** reach the agent through the public API, so private books never do.

## API

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/api/books?q=&ownerId=&excludeOwnerId=` | public: the shelf, newest first; `q` searches titles, authors, chapters, countries and places |
| GET | `/api/books/{id}` | public: the book with its chapters and their pages |
| POST | `/api/books` | signed in |
| PUT / DELETE | `/api/books/{id}` | book author (deleting removes its chapters too) |
| GET | `/api/destinations?ownerId=` | public: chapters with their pages, optionally one author's |
| GET | `/api/destinations/{id}` | public |
| POST | `/api/destinations` | signed in: `bookId` says which (of your) books; leave it out for a draft |
| PUT / DELETE | `/api/destinations/{id}` | chapter author; a `bookId` moves the chapter into that book |
| POST | `/api/destinations/{id}/places` | chapter author: add a page |
| PUT / DELETE | `/api/places/{id}` | chapter author |
| PUT / DELETE | `/api/places/{id}/like` | signed in: like / unlike a page |
| GET | `/api/places/{id}/comments` | public |
| POST | `/api/places/{id}/comments` | signed in |
| DELETE | `/api/comments/{id}` | the comment's author, or the page's author |

Pages are `places` in the API and database (they were pins before they were pages). Each one has a
`media` list, `likeCount`, `commentCount` and `likedByMe`; reads accept an optional access token, and
`likedByMe` is only ever true when one is sent.

Private books, and their chapters and pages, are left out of every list and answer 404 to everyone
but their author, so nobody else can read, like or comment on them, or tell that they exist. Draft
chapters (in no book yet, like a saved trip plan) are treated the same way, and stay off journey maps
until they're in a book.

Chapters are ordered within their book by start date; undated trips come last. Pages within a chapter are ordered
by visit date, and that order is the pin numbering, the dashed route on the map, and the order the
plane flies on the journey map.

## Notes

- Place search uses OpenStreetMap's free [Nominatim](https://nominatim.org/) service, and only on
  an explicit search, as its usage policy requires. Clicking the map works without it.
- Chapter cover images are still plain URLs; only pages have uploads.
- Photos and videos are public files: a private book hides its pages, but anyone who already has a
  photo's link can still open it.
- Uploads are capped at 50 MB per file and 20 per page. Files removed from a page, or uploaded to a
  page that was never saved, stay in Storage; nothing cleans them up yet.
- Authors are shown by the name they gave when signing up (their Supabase profile's `display_name`),
  or else the part of their email before the @. A book picks up name changes the next time it's saved.
