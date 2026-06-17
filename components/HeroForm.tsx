'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ArchitectureStory from './ArchitectureStory'

type Option = { id: string; name: string }
type Result = {
  id: string
  imageUrl: string
  videoUrl?: string
  issueUrl?: string
  videoFailed?: boolean
}

// Long edge cap for the uploaded selfie. iPhone/iPad photos are routinely
// 4000+ px / 5–10 MB — we resize client-side so we stay well under Vercel's
// serverless body limit (~4.5 MB) and don't waste booth wifi.
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.85

async function downscaleImage(file: File): Promise<File> {
  // Decode (createImageBitmap honors EXIF orientation in modern browsers).
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
  return new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
}

export default function HeroForm({
  defaultName,
  services,
}: {
  defaultName: string
  services: Option[]
}) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [heroName, setHeroName] = useState(defaultName)
  const [githubLogin, setGithubLogin] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [consent, setConsent] = useState(false)

  const [mode, setMode] = useState<'upload' | 'camera'>('upload')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Release the camera and revoke the last preview URL when this component
  // unmounts or we leave camera mode — otherwise the indicator stays on.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (preview) URL.revokeObjectURL(preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After the image is back, the video is still rendering async (completion
  // Lambda). Poll the job until the video lands so we can swap it in.
  useEffect(() => {
    if (status !== 'done' || !result || result.videoUrl || result.videoFailed) {
      return
    }
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/heroes/${result.id}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.videoUrl) {
          setResult((r) => (r ? { ...r, videoUrl: data.videoUrl } : r))
        } else if (data.status === 'video_failed') {
          setResult((r) => (r ? { ...r, videoFailed: true } : r))
        }
      } catch {
        /* keep polling */
      }
    }, 10_000)
    return () => clearInterval(t)
  }, [status, result])

  function swapPhoto(next: File) {
    if (preview) URL.revokeObjectURL(preview)
    setPhoto(next)
    setPreview(URL.createObjectURL(next))
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const small = await downscaleImage(f)
      swapPhoto(small)
    } catch {
      // If the resize fails for any reason, fall back to the raw file rather
      // than blocking submission — the server still accepts it.
      swapPhoto(f)
    }
  }

  async function startCamera() {
    setCameraError(null)
    try {
      // `facingMode: 'user'` picks the front camera on iPad; ignored on most
      // laptops (they just use their only webcam).
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraOn(true)
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}`
          : 'Camera unavailable',
      )
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const w = video.videoWidth
    const h = video.videoHeight
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      ),
    )
    swapPhoto(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
    stopCamera()
  }

  function switchMode(next: 'upload' | 'camera') {
    if (mode === next) return
    if (next === 'upload') stopCamera()
    setMode(next)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!photo) return
    setStatus('generating')
    setError(null)

    const body = new FormData()
    body.set('photo', photo)
    body.set('serviceId', serviceId)
    body.set('heroName', heroName)
    if (githubLogin) body.set('githubLogin', githubLogin)
    if (linkedinUrl) body.set('linkedinUrl', linkedinUrl)

    try {
      const res = await fetch('/api/heroes', { method: 'POST', body })
      if (!res.ok) throw new Error((await res.json()).error ?? 'generation failed')
      setResult(await res.json())
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  // ---- Stall page: shown while the synchronous pipeline runs ----------------
  if (status === 'generating') {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-ping rounded-full bg-[#FF9900]" />
          <h1 className="text-2xl font-bold tracking-tight">
            Forging your superstar…
          </h1>
        </div>
        <p className="mt-2 text-zinc-400">
          Compositing with Gemini — your image lands in a few seconds, then the
          animation renders in the background. Here&apos;s what&apos;s happening.
        </p>
        <div className="mt-8">
          <ArchitectureStory />
        </div>
      </div>
    )
  }

  // ---- Result ---------------------------------------------------------------
  if (status === 'done' && result) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight">You&apos;re a superstar! ⭐</h1>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-[3/4] bg-zinc-900">
            {result.videoUrl ? (
              <video
                src={result.videoUrl}
                poster={result.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.imageUrl} alt={heroName} className="h-full w-full object-cover" />
            )}
          </div>
        </div>
        {!result.videoUrl && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-zinc-500">
            {result.videoFailed ? (
              'The animation didn’t finish, but your superstar image is live.'
            ) : (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-[#FF9900]" />
                Animation is rendering — it’ll appear here and on the wall in a
                couple of minutes. You can leave this page; it keeps going.
              </>
            )}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {result.issueUrl && (
            <a
              href={result.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/10 px-5 py-2.5 font-medium hover:bg-white/20"
            >
              View GitHub issue ↗
            </a>
          )}
          <Link
            href="/"
            className="rounded-full bg-[#FF9900] px-5 py-2.5 font-medium text-zinc-950 hover:bg-[#ffad33]"
          >
            See the gallery
          </Link>
        </div>
      </div>
    )
  }

  // ---- Form -----------------------------------------------------------------
  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl px-6 py-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create your superstar</h1>
        <p className="mt-2 text-zinc-400">
          Pick a service, snap a photo, and we&apos;ll do the rest.
        </p>
      </div>

      {status === 'error' && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div>
        <span className="text-sm font-medium text-zinc-300">Your photo</span>

        <div className="mt-2 inline-flex rounded-full border border-white/10 bg-zinc-900 p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMode('upload')}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === 'upload' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => switchMode('camera')}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === 'camera' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Use camera
          </button>
        </div>

        {mode === 'upload' && (
          <input
            type="file"
            accept="image/*"
            // `capture="user"` makes iPad/iPhone offer the front camera straight
            // from the file picker; desktop browsers ignore it harmlessly.
            capture="user"
            onChange={onPhoto}
            className="mt-3 block w-full text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-[#FF9900] file:px-4 file:py-2 file:font-medium file:text-zinc-950"
          />
        )}

        {mode === 'camera' && (
          <div className="mt-3 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-[3/4] w-full object-cover ${cameraOn ? '' : 'hidden'}`}
              />
              {!cameraOn && (
                <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-zinc-500">
                  {cameraError ?? 'Camera is off'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20"
                >
                  Start camera
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="rounded-full bg-[#FF9900] px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-[#ffad33]"
                  >
                    Take photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-full bg-white/10 px-5 py-2 text-sm text-zinc-300 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-zinc-300">Preview</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="preview"
            className="h-40 w-40 rounded-2xl object-cover border border-white/10"
          />
          <button
            type="button"
            onClick={() => {
              if (preview) URL.revokeObjectURL(preview)
              setPhoto(null)
              setPreview(null)
            }}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Retake
          </button>
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium text-zinc-300">AWS service</span>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-300">Superstar name</span>
        <input
          value={heroName}
          onChange={(e) => setHeroName(e.target.value)}
          required
          className="mt-2 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-300">
            GitHub username <span className="text-zinc-500">(optional)</span>
          </span>
          <input
            value={githubLogin}
            onChange={(e) => setGithubLogin(e.target.value)}
            placeholder="octocat"
            className="mt-2 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-300">
            LinkedIn URL <span className="text-zinc-500">(optional)</span>
          </span>
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/…"
            className="mt-2 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-1"
        />
        <span>
          I consent to my original photo and an AI-generated version of me
          appearing in the public AWS Summit NYC gallery, and to the generated
          version being posted to a public GitHub gallery.
        </span>
      </label>

      <button
        type="submit"
        disabled={!photo || !consent}
        className="w-full rounded-full bg-[#FF9900] px-6 py-3 font-medium text-zinc-950 hover:bg-[#ffad33] disabled:opacity-40"
      >
        Generate my superstar
      </button>
    </form>
  )
}
