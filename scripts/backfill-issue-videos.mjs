// One-off backfill: patch hero GitHub issues whose video landed before the
// completion Lambda had its Auth0/GitHub env vars set (they were deployed as
// empty strings, so the Lambda silently bailed at the GITHUB_REPO guard).
//
// Mirrors the Lambda's logic (exchangeForGithubToken + patchIssueWithVideo)
// and is safely idempotent: it only patches issues whose body still contains
// the "_Animation pending..._" placeholder string from the original create.
//
// Run from the frontend (so node_modules has the AWS SDK + .env.local has
// AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET / GITHUB_ISSUE_REPO /
// HEROES_TABLE_NAME / ASSETS_CDN_DOMAIN already populated):
//
//   cd aws-service-heroes
//   AWS_PROFILE=focusotter-sandbox AWS_REGION=us-west-2 \
//     node --env-file=.env.local scripts/backfill-issue-videos.mjs

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.HEROES_TABLE_NAME
const CDN = process.env.ASSETS_CDN_DOMAIN
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET
const GITHUB_REPO = process.env.GITHUB_ISSUE_REPO
const CONNECTION = process.env.GITHUB_CONNECTION ?? 'github'

const required = {
  HEROES_TABLE_NAME: TABLE,
  ASSETS_CDN_DOMAIN: CDN,
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  GITHUB_ISSUE_REPO: GITHUB_REPO,
}
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(1)
  }
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const stranded = await listStrandedHeroes()
console.log(`Found ${stranded.length} stranded heroes.`)

let patched = 0
let skipped = 0
let failed = 0
for (const hero of stranded) {
  try {
    const result = await backfillOne(hero)
    if (result === 'patched') patched++
    else skipped++
  } catch (err) {
    failed++
    console.error(`[${hero.id}] failed:`, err instanceof Error ? err.message : err)
  }
}
console.log(`\nDone. patched=${patched} skipped=${skipped} failed=${failed}`)

async function listStrandedHeroes() {
  const items = []
  let ExclusiveStartKey
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          'attribute_exists(videoKey) AND attribute_exists(issueNumber) AND attribute_exists(refreshToken)',
        ProjectionExpression:
          'id, videoKey, issueNumber, refreshToken, heroName',
        ExclusiveStartKey,
      }),
    )
    items.push(...(res.Items ?? []))
    ExclusiveStartKey = res.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return items
}

async function backfillOne(hero) {
  const { id, issueNumber, videoKey, refreshToken, heroName } = hero
  const videoUrl = `https://${CDN}/${videoKey}`

  const [owner, repo] = GITHUB_REPO.split('/')
  const base = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`

  const githubToken = await exchangeForGithubToken(refreshToken)
  if (!githubToken) {
    throw new Error('token_exchange_failed')
  }
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'aws-service-heroes-backfill',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const current = await (await fetch(base, { headers })).json()
  const body = String(current.body ?? '')

  if (!body.includes('_Animation pending')) {
    console.log(
      `[${id}] issue #${issueNumber} (${heroName ?? 'unknown'}) already patched — skipping`,
    )
    return 'skipped'
  }

  const link = `🎬 [Animated version](${videoUrl})`
  const next = body.replace(/_Animation pending[^_]*_/, link)

  const res = await fetch(base, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: next }),
  })
  if (!res.ok) {
    throw new Error(`patch_failed status=${res.status} body=${await res.text()}`)
  }
  console.log(
    `[${id}] patched issue #${issueNumber} (${heroName ?? 'unknown'}) -> ${videoUrl}`,
  )
  return 'patched'
}

async function exchangeForGithubToken(refreshToken) {
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      subject_token: refreshToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:refresh_token',
      grant_type:
        'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token',
      requested_token_type:
        'http://auth0.com/oauth/token-type/federated-connection-access-token',
      connection: CONNECTION,
    }),
  })
  if (!res.ok) {
    console.error('  token exchange failed:', await res.text())
    return null
  }
  const json = await res.json()
  return json.access_token ?? null
}
