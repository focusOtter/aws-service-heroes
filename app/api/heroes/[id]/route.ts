import { NextResponse } from 'next/server'
import { getHero } from '@/lib/dynamo'
import { cdnUrl } from '@/lib/s3'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: RouteContext<'/api/heroes/[id]'>) {
  const { id } = await ctx.params
  const hero = await getHero(id)
  if (!hero) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({
    id: hero.id,
    status: hero.status,
    heroName: hero.heroName,
    serviceName: hero.serviceName,
    imageUrl: cdnUrl(hero.imageKey),
    originalUrl: hero.originalKey ? cdnUrl(hero.originalKey) : undefined,
    videoUrl: hero.videoKey ? cdnUrl(hero.videoKey) : undefined,
    issueUrl: hero.issueUrl,
  })
}
