'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type GalleryItem = {
  id: string
  heroName: string
  serviceName: string
  imageUrl: string
  originalUrl?: string
  videoUrl?: string
  issueUrl?: string
  createdAt: string
}

export default function Home() {
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<GalleryItem | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch('/api/heroes', { cache: 'no-store' })
        const data = await res.json()
        if (active) setGallery(data.gallery ?? [])
      } catch {
        /* keep last good state */
      } finally {
        if (active) setLoaded(true)
      }
    }
    load()
    const t = setInterval(load, 15_000) // live wall — refetch every 15s
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  // ESC closes the lightbox.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    // Prevent the page behind the modal from scrolling.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selected])

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <section className="text-center py-10">
        <p className="text-sm uppercase tracking-[0.2em] text-[#FF9900]">
          AWS Summit NYC
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">
          Become the superstar of your favorite AWS service
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          Snap a photo, pick a service, and walk away as that service&apos;s
          superstar — posted to a public GitHub gallery.
        </p>
        <Link
          href="/form"
          className="inline-block mt-7 rounded-full bg-[#FF9900] px-6 py-3 font-medium text-zinc-950 hover:bg-[#ffad33]"
        >
          Create your superstar
        </Link>
      </section>

      <h2 className="mt-8 mb-5 text-lg font-semibold text-zinc-200">
        The wall of superstars
      </h2>

      {loaded && gallery.length === 0 ? (
        <p className="text-zinc-500">No superstars yet — be the first.</p>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {gallery.map((h) => (
            <figure
              key={h.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5"
            >
              <button
                type="button"
                onClick={() => setSelected(h)}
                aria-label={`View ${h.heroName}`}
                className="block w-full text-left"
              >
                <div className="aspect-[3/4] overflow-hidden bg-zinc-900">
                  {h.videoUrl ? (
                    <video
                      src={h.videoUrl}
                      poster={h.imageUrl}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.imageUrl}
                      alt={h.heroName}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  )}
                </div>
              </button>
              <figcaption className="p-3">
                <p className="font-medium leading-tight">{h.heroName}</p>
                <p className="text-xs text-zinc-400">{h.serviceName}</p>
                {h.issueUrl && (
                  <a
                    href={h.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-[#FF9900] hover:underline"
                  >
                    View issue ↗
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {selected && (
        <Lightbox item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function Lightbox({
  item,
  onClose,
}: {
  item: GalleryItem
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.heroName} — before and after`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div
        // Stop clicks inside the panel from bubbling up to the backdrop and closing.
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-200 hover:bg-white/20"
        >
          Close ✕
        </button>

        <div className="mb-4 sm:mb-6">
          <h3 className="text-xl font-semibold tracking-tight">{item.heroName}</h3>
          <p className="text-sm text-zinc-400">Superstar of {item.serviceName}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel label="Original">
            {item.originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.originalUrl}
                alt="Original selfie"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                Original wasn&apos;t saved for this entry.
              </div>
            )}
          </Panel>

          <Panel label={item.videoUrl ? 'Generated (animated)' : 'Generated'}>
            {item.videoUrl ? (
              <video
                src={item.videoUrl}
                poster={item.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.heroName}
                className="h-full w-full object-contain"
              />
            )}
          </Panel>
        </div>

        {item.issueUrl && (
          <div className="mt-5 text-center">
            <a
              href={item.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20"
            >
              View GitHub issue ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Panel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-black">
        {children}
      </div>
    </div>
  )
}
