import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: '빨파레나',
    template: '%s · 빨파레나',
  },
  description: '정치·사회 이슈를 둘러싼 진영 대립 의견 공유 서비스',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.className} min-h-dvh antialiased`}>{children}</body>
    </html>
  )
}
