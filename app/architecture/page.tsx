import ArchitectureStory from '@/components/ArchitectureStory'

export const metadata = { title: 'Architecture · AWS Service Superstars' }

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm uppercase tracking-[0.2em] text-[#FF9900]">
        Under the hood
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        How your superstar gets made
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-400">
        Best-of-breed on AWS: storage, CDN, identity, and video all AWS-native,
        with one specialist node (Gemini) doing the single identity step AWS
        has no turnkey primitive for yet.
      </p>
      <div className="mt-8">
        <ArchitectureStory />
      </div>
    </div>
  )
}
