import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AskPanel } from '@/components/AskPanel'

export const metadata: Metadata = {
  title: 'San Budget',
  description: 'Personal budget tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'San Budget',
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="h-full bg-gray-900 font-sans antialiased text-white">
        {children}
        <AskPanel />
      </body>
    </html>
  )
}
