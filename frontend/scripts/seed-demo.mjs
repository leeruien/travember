// Fills a demo account with two sample books: four trips around the world, with photos, likes and comments.
// It signs in as that user and goes through the real API, exactly like the web app does.
//
//   DEMO_EMAIL=demo@example.com DEMO_PASSWORD=... npm run seed:demo
//   DEMO_EMAIL=demo@example.com DEMO_PASSWORD=... npm run seed:demo -- --reset   (replace their books)
//
// Create the user first: Supabase dashboard -> Authentication -> Users -> Add user -> Create new user,
// with "Auto Confirm User" ticked. The photos are placeholders from picsum.photos, not the real places.

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'page-media' // must match supabase/schema.sql

// The first book gets a cover of its own; the second has none, so it shows its first photo instead.
const books = [
  {
    title: 'Around the world in 2025',
    description: 'Ice, coastline and a Christmas in summer: a year of saying yes to the long way round.',
    cover: 'cover-around-the-world',
    chapters: ['Iceland Ring Road', 'Down the California coast', 'A weekend in Sydney'],
  },
  {
    title: 'Autumn in Japan',
    description: 'One week in Kyoto, mostly on foot.',
    cover: null,
    chapters: ['Autumn in Kyoto'],
  },
]

const chapters = [
  {
    title: 'Autumn in Kyoto',
    country: 'Japan',
    startDate: '2024-11-02',
    endDate: '2024-11-08',
    summary: 'A week of temples, maple leaves and far too much matcha.',
    pages: [
      {
        name: 'Fushimi Inari Taisha', latitude: 34.9671, longitude: 135.7727, visitedOn: '2024-11-02', photos: 3,
        note: 'Up the mountain through thousands of vermilion torii gates. Went early and had whole stretches to ourselves.',
      },
      {
        name: 'Arashiyama Bamboo Grove', latitude: 35.017, longitude: 135.6713, visitedOn: '2024-11-04', photos: 2,
        note: 'The sound of the wind in the bamboo is the thing nobody tells you about.',
      },
      { name: 'Kiyomizu-dera', latitude: 34.9949, longitude: 135.785, visitedOn: '2024-11-06', photos: 2, note: '' },
    ],
  },
  {
    title: 'Iceland Ring Road',
    country: 'Iceland',
    startDate: '2025-03-10',
    endDate: '2025-03-17',
    summary: 'Seven days, one small car, and weather that changed every twenty minutes.',
    pages: [
      {
        name: 'Hallgrímskirkja, Reykjavík', latitude: 64.1417, longitude: -21.9266, visitedOn: '2025-03-10', photos: 1,
        note: 'Started the loop here. The view from the tower is worth the queue.',
      },
      {
        name: 'Skógafoss', latitude: 63.5321, longitude: -19.5114, visitedOn: '2025-03-12', photos: 2,
        note: 'Soaked within a minute. Double rainbow on the way back to the car.',
      },
      { name: 'Jökulsárlón', latitude: 64.0784, longitude: -16.2306, visitedOn: '2025-03-14', photos: 0, note: 'Icebergs drifting out to sea, and seals watching us watch them.' },
    ],
  },
  {
    title: 'Down the California coast',
    country: 'United States',
    startDate: '2025-07-20',
    endDate: '2025-07-26',
    summary: 'Highway 1 from San Francisco to Los Angeles, stopping whenever the view demanded it.',
    pages: [
      { name: 'Golden Gate Bridge', latitude: 37.8199, longitude: -122.4783, visitedOn: '2025-07-20', photos: 2, note: 'Fog rolled in and out all morning.' },
      { name: 'Bixby Creek Bridge', latitude: 36.3715, longitude: -121.902, visitedOn: '2025-07-22', photos: 1, note: '' },
      {
        name: 'Santa Monica Pier', latitude: 34.0094, longitude: -118.4973, visitedOn: '2025-07-25', photos: 2,
        note: 'End of the road, and of Route 66 too. Sunset from the Ferris wheel.',
      },
    ],
  },
  {
    title: 'A weekend in Sydney',
    country: 'Australia',
    startDate: '2025-12-27',
    endDate: '2025-12-29',
    summary: 'Summer at Christmas still feels wrong, in the best way.',
    pages: [
      { name: 'Sydney Opera House', latitude: -33.8568, longitude: 151.2153, visitedOn: '2025-12-27', photos: 2, note: 'Even better up close.' },
      {
        name: 'Bondi Beach', latitude: -33.8915, longitude: 151.2767, visitedOn: '2025-12-29', photos: 1,
        note: 'Walked the coastal path to Coogee and back.',
      },
    ],
  },
]

const comments = {
  'Fushimi Inari Taisha': 'Going back in spring to see it without the crowds.',
  'Skógafoss': 'Bring a waterproof jacket. Trust me.',
  'Sydney Opera House': 'We caught a show here on the last night, highly recommend.',
}
const liked = ['Fushimi Inari Taisha', 'Skógafoss', 'Bixby Creek Bridge', 'Bondi Beach']

function fail(message) {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key, DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env
const apiUrl = (process.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '')
const reset = process.argv.includes('--reset')

if (!url || !key) fail('frontend/.env needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
if (!email || !password) fail('Set DEMO_EMAIL and DEMO_PASSWORD to the demo user you created in the Supabase dashboard.')

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const signIn = await supabase.auth.signInWithPassword({ email, password })
if (signIn.error) {
  fail(`Couldn't sign in as ${email}: ${signIn.error.message}.\n  Create the user first: Supabase dashboard → Authentication → Users → Add user → Create new user, with "Auto Confirm User" ticked.`)
}
const userId = signIn.data.user.id

// A display name for comments; refresh so the access token carries it.
await supabase.auth.updateUser({ data: { display_name: 'Demo Traveller' } })
const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
if (refreshError) fail(`Couldn't refresh the session: ${refreshError.message}`)
const token = refreshed.session.access_token

async function call(method, path, body) {
  let res
  try {
    res = await fetch(apiUrl + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    })
  } catch {
    fail(`Can't reach the API at ${apiUrl}. Is the backend running?`)
  }
  if (!res.ok) fail(`${method} ${path} failed (${res.status}): ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function uploadPlaceholder(seed, width = 1200, height = 800) {
  const res = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`)
  if (!res.ok) throw new Error(`picsum.photos answered ${res.status}`)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, await res.arrayBuffer(), { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return { kind: 'image', url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

const existing = await call('GET', `/api/books?ownerId=${userId}`)
if (existing.length > 0 && !reset) {
  fail(`${email} already has ${existing.length} book(s). Re-run with \`-- --reset\` to replace them.`)
}
for (const b of existing) {
  await call('DELETE', `/api/books/${b.id}`) // takes its chapters and pages with it
  console.log(`Removed old book “${b.title}”`)
}

let pageCount = 0
let photoCount = 0
for (const { chapters: titles, cover, ...fields } of books) {
  let coverUrl = ''
  if (cover) {
    try {
      coverUrl = (await uploadPlaceholder(cover, 900, 1200)).url
    } catch (e) {
      console.warn(`! cover for ${fields.title} skipped: ${e.message}`)
    }
  }
  const book = await call('POST', '/api/books', { ...fields, coverUrl })
  console.log(`\n📕 ${book.title}${coverUrl ? ' (own cover)' : ' (first photo as cover)'}`)

  for (const { pages, ...chapterFields } of chapters.filter((c) => titles.includes(c.title))) {
    const created = await call('POST', '/api/destinations', { ...chapterFields, bookId: book.id, coverImageUrl: '' })
    console.log(`  ${created.title}`)

    for (const { photos, ...page } of pages) {
      const media = []
      for (let i = 0; i < photos; i++) {
        try {
          media.push(await uploadPlaceholder(`${page.name}-${i}`))
        } catch (e) {
          console.warn(`    ! photo ${i + 1} for ${page.name} skipped: ${e.message}`)
        }
      }
      const saved = await call('POST', `/api/destinations/${created.id}/places`, { ...page, media })
      if (liked.includes(saved.name)) await call('PUT', `/api/places/${saved.id}/like`)
      if (comments[saved.name]) await call('POST', `/api/places/${saved.id}/comments`, { body: comments[saved.name] })
      pageCount++
      photoCount += media.length
      console.log(`    ✓ ${saved.name} (${media.length} photo${media.length === 1 ? '' : 's'})`)
    }
  }
}

console.log(`\nDone: ${books.length} books, ${chapters.length} chapters, ${pageCount} pages, ${photoCount} photos for ${email}.`)
console.log('Sign in as them and open “My books” (http://localhost:5173/me),')
console.log(`and the whole journey at http://localhost:5173/travellers/${userId}/journey`)
