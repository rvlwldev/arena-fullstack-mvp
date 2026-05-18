import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RED BLUE ARENA',
  description: '진영 대립 이슈에 대한 의견 공유 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  )
}
