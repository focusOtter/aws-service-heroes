import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { auth0 } from '@/lib/auth0'
import { DEFAULT_PRESET, findService, buildImagePrompt, buildVideoPrompt } from '@/lib/services'
import { generateHeroImage } from '@/lib/gemini'
import { startHeroVideo } from '@/lib/bedrock'
import { uploadAsset, cdnUrl } from '@/lib/s3'
import { putHero, patchHero, listHeroes, type HeroRecord } from '@/lib/dynamo'
import { createHeroIssue } from '@/lib/github'

// AWS SDK needs the Node runtime. We return as soon as the image + issue are
// done and the video job is started; Luma finishes async (completion Lambda).
export const runtime = 'nodejs'
export const maxDuration = 60

const ext = (mediaType: string) => (mediaType.includes('jpeg') ? 'jpg' : 'png')

export async function POST(request: NextRequest) {
  // Login-gated (Auth0 email/social — never a forced GitHub connection).
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const photo = form.get('photo')
  const serviceId = String(form.get('serviceId') ?? '')
  const heroName = String(form.get('heroName') ?? session.user.name ?? 'Superstar').trim()
  const githubLogin = (form.get('githubLogin') as string)?.trim() || undefined
  const linkedinUrl = (form.get('linkedinUrl') as string)?.trim() || undefined

  const service = findService(serviceId)
  // Single style only — pinned server-side, not client-supplied.
  const preset = DEFAULT_PRESET
  if (!(photo instanceof File) || !service) {
    return NextResponse.json({ error: 'invalid submission' }, { status: 400 })
  }

  const id = randomUUID()
  const selfieBytes = new Uint8Array(await photo.arrayBuffer())
  const selfieType = photo.type || 'image/jpeg'

  // Stash the original selfie so the gallery lightbox can show before/after.
  // Already downscaled to <=1280px JPEG client-side, so this is cheap. We don't
  // block submission if the upload trips — the composite path is what matters.
  let originalKey: string | undefined
  try {
    originalKey = `originals/${id}.${ext(selfieType)}`
    await uploadAsset(originalKey, selfieBytes, selfieType)
  } catch (err) {
    console.warn('[POST /api/heroes] could not store original selfie:', err)
    originalKey = undefined
  }

  // ---- Stage 1: Gemini composite (the step that must always succeed) -------
  let image
  try {
    image = await generateHeroImage(
      buildImagePrompt(service, preset, heroName),
      { data: selfieBytes, mediaType: selfieType },
    )
  } catch (err) {
    console.error('[POST /api/heroes] image generation failed:', err)
    // Gemini returns 503 UNAVAILABLE during demand spikes — retryable.
    const msg = err instanceof Error ? err.message : ''
    const overloaded = /high demand|UNAVAILABLE|503|overloaded/i.test(msg)
    return NextResponse.json(
      {
        error: overloaded
          ? 'The image model is busy right now — please try again in a moment.'
          : 'image_generation_failed',
      },
      { status: overloaded ? 503 : 502 },
    )
  }

  const imageKey = `images/${id}.${ext(image.mediaType)}`
  await uploadAsset(imageKey, image.data, image.mediaType)
  const imageUrl = cdnUrl(imageKey)

  const record: HeroRecord = {
    id,
    entity: 'hero',
    createdAt: new Date().toISOString(),
    status: 'image_ready',
    heroName,
    serviceId: service.id,
    serviceName: service.name,
    presetId: preset.id,
    imageKey,
    originalKey,
    githubLogin,
    linkedinUrl,
    userSub: session.user.sub,
    // Stored for the completion Lambda's no-session token exchange.
    refreshToken: session.tokenSet.refreshToken,
  }
  await putHero(record)

  // ---- GitHub issue via Token Vault (image now; Lambda patches video later) -
  let issueUrl: string | undefined
  try {
    const { token } = await auth0.getAccessTokenForConnection({ connection: 'github' })
    const issue = await createHeroIssue({
      token,
      heroName,
      serviceName: service.name,
      presetName: preset.name,
      imageUrl,
      githubLogin,
      linkedinUrl,
    })
    issueUrl = issue.url
    await patchHero(id, { issueNumber: issue.number, issueUrl })
  } catch (err) {
    // Common causes: GitHub not connected (token exchange fails), or the repo
    // is private / the connection lacks public_repo scope (GitHub returns 404).
    const status = (err as { status?: number })?.status
    console.warn(
      `[POST /api/heroes] GitHub issue not posted${status ? ` (HTTP ${status})` : ''}:`,
      err instanceof Error ? err.message : err,
    )
  }

  // ---- Start Luma async — returns immediately; the completion Lambda fires
  //      when the mp4 lands in S3. Allowed to fail without blocking the image.
  try {
    const invocationArn = await startHeroVideo({
      prompt: buildVideoPrompt(service, preset),
      image,
      outputPrefix: `videos/${id}`,
    })
    await patchHero(id, { status: 'video_pending', invocationArn })
  } catch (err) {
    console.warn('[POST /api/heroes] could not start video — image stands:', err)
    await patchHero(id, { status: 'video_failed' })
  }

  return NextResponse.json({
    id,
    imageUrl,
    originalUrl: originalKey ? cdnUrl(originalKey) : undefined,
    issueUrl,
  })
}

export async function GET() {
  const heroes = await listHeroes()
  const gallery = heroes.map((h) => ({
    id: h.id,
    heroName: h.heroName,
    serviceName: h.serviceName,
    imageUrl: cdnUrl(h.imageKey),
    originalUrl: h.originalKey ? cdnUrl(h.originalKey) : undefined,
    videoUrl: h.videoKey ? cdnUrl(h.videoKey) : undefined,
    issueUrl: h.issueUrl,
    createdAt: h.createdAt,
  }))
  return NextResponse.json({ gallery })
}
