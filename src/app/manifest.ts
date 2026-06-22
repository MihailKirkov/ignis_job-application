import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Job Command Center',
    short_name: 'Job CC',
    description:
      'AI-scored job discovery and pipeline tracker — ingests roles from a dozen sources daily, scores each against your profile, and ranks your inbox best-fit-first.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#060A12',
    background_color: '#060A12',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
