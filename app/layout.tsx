import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/components/theme/ThemeProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'LeadFlow | CRM & Automation',
    template: '%s | LeadFlow',
  },
  description: 'Internes Sales-CRM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: Die Klasse "dark" setzt das Inline-Script vor React.
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="overflow-x-clip font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
