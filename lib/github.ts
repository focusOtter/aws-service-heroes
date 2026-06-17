import { Octokit } from 'octokit'

const ISSUE_REPO = process.env.GITHUB_ISSUE_REPO ?? '' // "owner/name"
const EVENT_LABEL = 'aws-summit-nyc'

function repoParts() {
  const [owner, repo] = ISSUE_REPO.split('/')
  if (!owner || !repo) {
    throw new Error('GITHUB_ISSUE_REPO must be set to "owner/name"')
  }
  return { owner, repo }
}

/** Validate a handle before @-mentioning so a typo never pings a stranger. */
export async function validateGithubLogin(
  token: string,
  login: string,
): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token })
    await octokit.rest.users.getByUsername({ username: login })
    return true
  } catch {
    return false
  }
}

export type IssueInput = {
  token: string
  heroName: string
  serviceName: string
  presetName: string
  imageUrl: string
  videoUrl?: string
  githubLogin?: string
  linkedinUrl?: string
}

/**
 * Create the gallery issue via the user's (or booth's) Token Vault GitHub
 * token. The hero image embeds inline; the mp4 is linked (GitHub only renders
 * its own CDN videos inline — external mp4s render as links).
 */
export async function createHeroIssue(
  input: IssueInput,
): Promise<{ number: number; url: string }> {
  const { owner, repo } = repoParts()
  const octokit = new Octokit({ auth: input.token })

  // Only mention a handle we could verify exists.
  let mention = ''
  if (input.githubLogin) {
    const ok = await validateGithubLogin(input.token, input.githubLogin)
    if (ok) mention = ` (@${input.githubLogin})`
  }

  const lines = [
    `![${input.heroName}](${input.imageUrl})`,
    '',
    `**${input.heroName}**${mention} is the superstar of **${input.serviceName}**.`,
    `Style: ${input.presetName}.`,
    '',
    input.videoUrl ? `🎬 [Animated version](${input.videoUrl})` : '_Animation pending or unavailable._',
  ]

  if (input.linkedinUrl) {
    lines.push('', `🔗 ${input.linkedinUrl}`)
  }

  const issue = await octokit.rest.issues.create({
    owner,
    repo,
    title: `${input.heroName} — Superstar of ${input.serviceName}`,
    body: lines.join('\n'),
    labels: [EVENT_LABEL],
  })

  return { number: issue.data.number, url: issue.data.html_url }
}
