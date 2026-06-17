# AWS Service Heroes — Frontend (Next.js)

A booth experience for **AWS Summit NYC**. An attendee picks a favorite AWS service, takes a
photo, and chooses a style preset. The app generates an identity-preserving "hero" composite,
animates it into a short video, posts the result to a central GitHub repo as an issue, and
fills a live gallery.

This is the **Next.js 16 frontend** (deploys to Vercel). The AWS resources live in the sibling
[`aws-service-heroes-backend`](../aws-service-heroes-backend) CDK app. See
[`../aws-service-heroes-architecture.md`](../aws-service-heroes-architecture.md) for the full
design rationale.

> **Next.js 16 note:** Middleware is now **Proxy** (`proxy.ts`, not `middleware.ts`), and API
> endpoints are **Route Handlers** (`app/api/**/route.ts`). Read `node_modules/next/dist/docs/`
> before changing framework-level code.

## The generation flow (image-first, video async)

`POST /api/heroes` returns as soon as the image is ready, so the booth device frees in seconds
and many attendees can generate at once:

1. **Gemini (Nano Banana)** composites the selfie into a hero still (`maxRetries` + a fallback
   model, because `gemini-3-pro-image` 503s under load).
2. The still is uploaded to **S3**; a job record (incl. the Auth0 **refresh token**) is written
   to **DynamoDB**.
3. A **GitHub issue** is created via **Auth0 Token Vault** (no PAT) — image only, for now.
4. **Bedrock Luma Ray 2** is started with `StartAsyncInvoke` and the route **returns
   immediately** (`{ id, imageUrl, issueUrl }`). If the start fails, the image still stands.
5. Minutes later the mp4 lands in S3. An **S3 `ObjectCreated` event triggers the CDK completion
   Lambda**, which marks the job complete and **patches the GitHub issue with the video link via
   a no-session federated-connection token exchange** — the Token Vault "acts after the user
   has left" demo.

The result page polls `GET /api/heroes/[id]` to swap in the video when it arrives; the gallery
(15s poll) shows it on the wall. Assets are served through **CloudFront** (cached — booth wifi).
No AppSync/realtime layer; the gallery reads DynamoDB and refetches.

## Pages

| Route            | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `/`              | Home / live gallery wall (hero image + video per submission).           |
| `/settings`      | Connect GitHub via Auth0 Token Vault (opt-in "post as me").             |
| `/form`          | Photo capture + service + name + GitHub/LinkedIn. **Login-gated.**      |
| `/architecture`  | Shown right after submit — talking point while generation runs.         |

## API routes

| Route                        | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `POST /api/heroes`           | Image + issue + start video; returns immediately (see flow above).         |
| `GET /api/heroes`            | Gallery list (reads DynamoDB).                                             |
| `GET /api/heroes/[id]`       | Single job status — the result page polls this for the video.              |
| `GET /api/github/post-install` | GitHub App setup URL — redirects to `/auth/connect?connection=github` so a user who just installed the app immediately connects it through Auth0. |

## Environment variables

Copy your values into `.env.local`:

```bash
# Auth0 (already configured)
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=focusotter-demos.us.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=...

# Gemini image model (already configured)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3-pro-image
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-image   # used if the primary 503s

# GitHub App (already configured)
GITHUB_APP_PUBLIC_URL=https://github.com/apps/aws-service-heroes

# --- Added for this app ---
AWS_REGION=us-west-2

# Local dev only: which local profile to use for the AWS SDK.
# In production on Vercel, leave AWS_PROFILE unset and set AWS_ROLE_ARN (OIDC) instead.
AWS_PROFILE=focusotter-sandbox
# AWS_ROLE_ARN=arn:aws:iam::842537737558:role/...   # from CDK output, Vercel prod only

# From the CDK stack outputs (npx cdk deploy):
ASSETS_BUCKET_NAME=...
ASSETS_CDN_DOMAIN=...           # CloudFront distribution domain
HEROES_TABLE_NAME=...

# Bedrock Luma Ray 2 (us-west-2 only)
LUMA_MODEL_ID=luma.ray-v2:0

# Central GitHub repo that issues are posted to (owner/name)
GITHUB_ISSUE_REPO=focusotter/aws-service-heroes-gallery
```

### AWS credentials: local vs Vercel

- **Local dev** uses your AWS profile (`AWS_PROFILE`) via the default credential chain.
- **Vercel (prod)** uses **OIDC federation** — no static keys. Set `AWS_ROLE_ARN` to the role
  the CDK stack creates; the SDK calls `AssumeRoleWithWebIdentity` through
  `@vercel/oidc-aws-credentials-provider`. The credential selection happens automatically in
  [`lib/aws.ts`](lib/aws.ts).

## Getting started

```bash
# 1. Deploy the backend first and copy its outputs into .env.local
cd ../aws-service-heroes-backend && npx cdk deploy --profile focusotter-sandbox

# 2. Run the frontend
cd ../aws-service-heroes && npm install && npm run dev
```

Open <http://localhost:3000>.

## Auth0 / Token Vault prerequisites

- A **GitHub social connection** named `github` with **Token Vault enabled** and **MFA policy
  `Never`** (or token retrieval errors).
- The app must allow **refresh tokens** (`offline_access`) — they're needed both at submit time
  and (stored) for the completion Lambda's later no-session exchange.
- `lib/auth0.ts` sets **`enableConnectAccountEndpoint: true`** — without it `/auth/connect`
  404s and GitHub can never be connected.
- The Next.js SDK exchanges the user's refresh token for a GitHub token at submit time via
  `auth0.getAccessTokenForConnection({ connection: 'github' })` and posts the issue immediately;
  the completion Lambda re-exchanges the stored refresh token later to patch in the video.
