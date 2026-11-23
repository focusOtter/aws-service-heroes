// Posting heroes to the GitHub gallery needs a user-linked GitHub account
// (Auth0 Token Vault), so it is opt-in. NEXT_PUBLIC_ so client pages see it too.
export const GITHUB_POSTING_ENABLED =
  process.env.NEXT_PUBLIC_GITHUB_POSTING_ENABLED === 'true'
