import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/lib/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'VitalTrack', template: '%s | VitalTrack' },
  description: 'Your health, clearly tracked.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vitaltrack.health'),
  icons: { icon: '/favicon.ico' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#1E6FD9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-neutral-50 text-neutral-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
