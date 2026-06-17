import { auth0 } from '@/lib/auth0'

export const metadata = { title: 'Settings · AWS Service Superstars' }

async function isGithubConnected(): Promise<boolean> {
  // If Token Vault can hand us a GitHub token, the connection is linked.
  try {
    const { token } = await auth0.getAccessTokenForConnection({ connection: 'github' })
    return Boolean(token)
  } catch {
    return false
  }
}

export default async function SettingsPage() {
  const session = await auth0.getSession()
  const githubConnected = session ? await isGithubConnected() : false

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {!session ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-zinc-300">Sign in to connect your accounts.</p>
          <a
            href="/auth/login?returnTo=/settings"
            className="mt-4 inline-block rounded-full bg-[#FF9900] px-5 py-2.5 font-medium text-zinc-950 hover:bg-[#ffad33]"
          >
            Sign in
          </a>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
            <div>
              <p className="font-medium">{session.user.name ?? session.user.email}</p>
              <p className="text-sm text-zinc-400">{session.user.email}</p>
            </div>
            <a
              href="/auth/logout"
              className="text-sm text-zinc-400 hover:text-white"
            >
              Sign out
            </a>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Connect GitHub</h2>
              {githubConnected && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400">
                  ✓ Connected
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {githubConnected
                ? 'Your GitHub account is linked through Auth0 Token Vault. Gallery issues will be posted as you — no personal access token.'
                : 'Opt in to “post as me”. We use Auth0 Token Vault to open the gallery issue under your account — no personal access token, and you only do this once.'}
            </p>
            <a
              href="/auth/connect?connection=github&returnTo=/settings"
              className="mt-4 inline-block rounded-full bg-white/10 px-5 py-2.5 font-medium hover:bg-white/20"
            >
              {githubConnected ? 'Reconnect GitHub' : 'Connect GitHub Account'}
            </a>
          </div>
        </>
      )}
    </div>
  )
}
