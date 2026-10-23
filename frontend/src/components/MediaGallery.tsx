import { useState } from 'react'
import type { Media } from '../api'
import { uploadMedia } from '../media'

const MAX_MEDIA = 20 // the API's limit per page

/** A page's photos and videos as a strip you can swipe or scroll through. */
export function MediaGallery({ media }: { media: Media[] }) {
  if (media.length === 0) return null
  return (
    <div className={`gallery ${media.length === 1 ? 'gallery--single' : ''}`}>
      {media.map((m, i) => (
        <figure key={m.url} className="gallery-item">
          {m.kind === 'video' ? (
            <video src={m.url} controls playsInline preload="metadata" />
          ) : (
            <img src={m.url} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
          )}
        </figure>
      ))}
      {media.length > 1 && <span className="gallery-count">{media.length} photos & videos</span>}
    </div>
  )
}

/** A still for lists and cards. Videos show their first frame (`#t` nudges Safari into drawing it). */
export function MediaThumb({ media, className }: { media: Media; className?: string }) {
  return media.kind === 'video' ? (
    <video className={className} src={`${media.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
  ) : (
    <img className={className} src={media.url} alt="" loading="lazy" />
  )
}

/** The page editor's photo and video picker. Files upload as soon as they're chosen. */
export function MediaPicker({ media, onAdd, onRemove, onUploadingChange }: {
  media: Media[]
  onAdd: (items: Media[]) => void
  onRemove: (index: number) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const [uploading, setUploading] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const room = MAX_MEDIA - media.length

  async function pick(files: File[]) {
    if (files.length === 0) return
    const batch = files.slice(0, room)
    setErrors(files.length > room ? [`A page holds up to ${MAX_MEDIA} photos and videos.`] : [])
    setUploading(batch.length)
    onUploadingChange(true)
    const results = await Promise.allSettled(batch.map(uploadMedia))
    onAdd(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
    setErrors((e) => [...e, ...results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as Error).message] : []))])
    setUploading(0)
    onUploadingChange(false)
  }

  return (
    <div className="media-picker">
      <span className="media-picker-label">Photos & videos</span>
      {media.length > 0 && (
        <ul className="media-grid">
          {media.map((m, i) => (
            <li key={m.url}>
              <MediaThumb media={m} className="media-grid-thumb" />
              {m.kind === 'video' && <span className="media-badge" aria-hidden="true">▶</span>}
              <button type="button" className="media-remove" onClick={() => onRemove(i)}
                aria-label={`Remove ${m.kind === 'video' ? 'video' : 'photo'} ${i + 1}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <label className="button button--ghost media-add" aria-disabled={uploading > 0}>
          {uploading > 0 ? `Uploading ${uploading}…` : '+ Add photos or videos'}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            disabled={uploading > 0}
            className="visually-hidden"
            onChange={(e) => {
              pick(Array.from(e.target.files ?? []))
              e.target.value = '' // so choosing the same file again still fires
            }}
          />
        </label>
      )}
      {errors.map((e) => <p key={e} className="error small" role="alert">{e}</p>)}
    </div>
  )
}
