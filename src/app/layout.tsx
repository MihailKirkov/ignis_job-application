import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const SITE_URL = 'https://ignis-job-application.vercel.app';
const DESCRIPTION =
  'AI-scored job discovery and pipeline tracker — ingests roles from a dozen sources daily, scores each against your profile, and ranks your inbox best-fit-first.';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Job Command Center',
    template: '%s · Job Command Center',
  },
  description: DESCRIPTION,
  applicationName: 'Job Command Center',
  authors: [{ name: 'Mihail Kirkov' }],
  creator: 'Mihail Kirkov',
  keywords: [
    'job search',
    'job tracker',
    'application tracker',
    'AI job matching',
    'job discovery',
    'ATS aggregator',
    'fit scoring',
    'job pipeline',
  ],
  // app/opengraph-image.tsx and app/twitter-image.tsx supply the images.
  openGraph: {
    type: 'website',
    siteName: 'Job Command Center',
    url: '/',
    locale: 'en',
    title: 'Job Command Center',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Job Command Center',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#060A12',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
