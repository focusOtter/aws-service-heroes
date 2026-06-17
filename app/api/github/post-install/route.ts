import { NextRequest, NextResponse } from 'next/server'

/**
 * GitHub App "Setup URL" target. After a user installs the GitHub App, GitHub
 * redirects here — and we forward them straight into the Auth0 GitHub social
 * connection flow so the app is immediately usable as a Token Vault grant.
 *
 * (Same intent as the architecture doc's <a href="/auth/connect?...">, just as
 * a redirect so it can be GitHub's post-install destination.)
 */
export async function GET(request: NextRequest) {
  const base = process.env.APP_BASE_URL ?? request.nextUrl.origin
  const connect = new URL('/auth/connect', base)
  connect.searchParams.set('connection', 'github')
  connect.searchParams.set('returnTo', '/settings')
  return NextResponse.redirect(connect)
}
