import { Auth0Client } from '@auth0/nextjs-auth0/server'

export const auth0 = new Auth0Client({
  // Mounts GET /auth/connect (the Token Vault "connect GitHub" flow). It is
  // OFF by default in the SDK, which makes /auth/connect 404 — and with no
  // connection there's nothing for getAccessTokenForConnection to exchange.
  enableConnectAccountEndpoint: true,
})
