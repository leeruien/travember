import type { Media } from './api'
import { supabase } from './supabase'

/** Must match the bucket created in supabase/schema.sql. */
const BUCKET = 'page-media'

/** The bucket's limit, and the most a free Supabase project accepts per file. */
const MAX_BYTES = 50 * 1024 * 1024

/**
 * Uploads a photo or video straight to Supabase Storage and returns it ready to put on a page.
 * Files go in a folder named after the uploader: Storage only lets you write to your own folder,
 * and the API only accepts media from the page author's folder.
 */
export async function uploadMedia(file: File): Promise<Media> {
  const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
  if (!kind) throw new Error(`“${file.name}” isn't a photo or a video.`)
  if (file.size > MAX_BYTES) throw new Error(`“${file.name}” is over 50 MB.`)

  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Please sign in first.')

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const path = `${data.session.user.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000', // the name is random, so the file never changes
  })
  if (error) throw new Error(`Couldn't upload “${file.name}”: ${error.message}`)

  return { kind, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}
