import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { AWS_SERVICES } from '@/lib/services'
import HeroForm from '@/components/HeroForm'

export const metadata = { title: 'Create · AWS Service Superstars' }

export default async function FormPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect('/auth/login?returnTo=/form')
  }

  return (
    <HeroForm
      defaultName={session.user.name ?? ''}
      services={AWS_SERVICES.map((s) => ({ id: s.id, name: s.name }))}
    />
  )
}
