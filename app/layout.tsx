import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Manrope } from 'next/font/google'
import './globals.css'

const currencyFontStack =
  "'Noto Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, system-ui, sans-serif"

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'СтройАудит.ai — экспресс-аудит проекта до начала стройки',
  description:
    'ИИ-аудит ИЖС за 15 минут: проверка чертежей и сметы на соответствие нормативам вашей страны, поиск скрытых ошибок и оценка влияния на бюджет.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FAFAFA',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${jetbrains.variable} bg-background`}
      style={{ '--font-currency': currencyFontStack } as React.CSSProperties}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
