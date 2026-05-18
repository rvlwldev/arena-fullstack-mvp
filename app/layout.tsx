import type { Metadata } from 'next'
import './globals.css'
import { Header } from './_components/Header'

export const metadata: Metadata = {
  title: 'RED BLUE ARENA',
  description: '진영 대립 이슈에 대한 의견 공유 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Header />
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  )
}
