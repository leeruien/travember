import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Shown as a banner instead of crashing, so a fresh checkout still renders something useful. */
export const configError =
  url && key
    ? null
    : 'Supabase is not configured: copy frontend/.env.example to frontend/.env, fill it in, and restart the dev server.'

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key')
