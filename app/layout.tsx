import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AWS Service Superstars',
  description: 'Become the superstar of your favorite AWS service — AWS Summit NYC.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-white/10 sticky top-0 z-10 backdrop-blur bg-zinc-950/70">
          <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="text-[#FF9900]">AWS</span> Service Superstars
            </Link>
            <div className="flex items-center gap-5 text-sm text-zinc-300">
              <Link href="/" className="hover:text-white">Gallery</Link>
              <Link href="/architecture" className="hover:text-white">Architecture</Link>
              <Link href="/settings" className="hover:text-white">Settings</Link>
              <Link
                href="/form"
                className="rounded-full bg-[#FF9900] px-4 py-1.5 font-medium text-zinc-950 hover:bg-[#ffad33]"
              >
                Create yours
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
