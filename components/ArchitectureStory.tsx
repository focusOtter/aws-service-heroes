const STEPS: { title: string; body: string; video?: boolean }[] = [
  {
    title: 'You, captured',
    body: 'Your selfie + chosen AWS service are posted to a Next.js Route Handler on Vercel — login-gated by Auth0.',
  },
  {
    title: 'Nano Banana composites',
    body: 'Gemini (identity-preserving) drops your face into an AWS-themed superstar scene. The still is stored in S3 and a job record lands in DynamoDB.',
  },
  {
    title: 'Luma Ray 2 animates',
    video: true,
    body: 'Bedrock animates the still into a short clip (us-west-2). If the video step fails, your image still ships — the loop never breaks.',
  },
  {
    title: 'Posted as an issue',
    body: 'Once you connect GitHub, Auth0 Token Vault hands the app a GitHub token (no PAT) to open an issue in the gallery repo — your name on a public, addressable URL.',
  },
  {
    title: 'The wall fills up',
    body: 'CloudFront caches every asset (kind to conference wifi); the live gallery reads DynamoDB and shows your superstar next to everyone else’s.',
  },
]

export default function ArchitectureStory({
  videoEnabled = true,
}: {
  videoEnabled?: boolean
}) {
  const steps = STEPS.filter((s) => videoEnabled || !s.video)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {steps.map((s, i) => (
        <div
          key={s.title}
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h3 className="font-semibold text-[#FF9900]">{i + 1} · {s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{s.body}</p>
        </div>
      ))}
    </div>
  )
}
