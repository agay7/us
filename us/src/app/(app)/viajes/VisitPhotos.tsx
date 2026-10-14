'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Photo = { id: string; url: string }

// The visit-photos bucket is private, so a stored path isn't viewable
// directly — it needs a signed URL per photo. Fetched lazily here (only
// for visits actually rendered, and only once per mount) rather than
// eagerly for the whole list, since most visits have zero photos anyway.
//
// Takes the raw `photos` array (not a pre-mapped `string[]` of paths) and
// derives paths internally via useMemo: `visit.visit_photos` keeps the
// same array reference across unrelated re-renders of the parent tab
// (search, filters, editing a different visit), but a `.map()` done in
// the caller before passing it down would produce a new array every
// render, re-triggering this component's fetch effect on every keystroke
// elsewhere on the page.
export default function VisitPhotos({ photos }: { photos: Photo[] }) {
  const paths = useMemo(() => photos.map((p) => p.url), [photos])
  const [urls, setUrls] = useState<string[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    if (paths.length === 0) {
      setUrls([])
      return
    }

    let cancelled = false
    const supabase = createClient()
    supabase.storage
      .from('visit-photos')
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return
        setUrls(data.map((d) => d.signedUrl).filter((url): url is string => !!url))
      })

    return () => {
      cancelled = true
    }
  }, [paths])

  useEffect(() => {
    if (!lightboxUrl) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxUrl(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxUrl])

  if (paths.length === 0) return null

  return (
    <>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {urls.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setLightboxUrl(url)}
            className="h-14 w-14 shrink-0 overflow-hidden rounded border border-gray-300"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs expire; next/image's remote-pattern allowlist isn't worth configuring for a URL that won't be stable anyway */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </>
  )
}
