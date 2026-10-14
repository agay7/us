'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// The visit-photos bucket is private, so a stored path isn't viewable
// directly — it needs a signed URL per photo. Fetched lazily here (only
// for visits actually rendered, and only once per mount) rather than
// eagerly for the whole list, since most visits have zero photos anyway.
export default function VisitPhotos({ paths }: { paths: string[] }) {
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
