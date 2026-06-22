import type { MetadataRoute } from 'next';

const SITE_URL = 'https://ignis-job-application.vercel.app';

// Only the publicly indexable routes — every authed surface redirects to login.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
