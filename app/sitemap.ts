import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-10-23')

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/offer`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/refund`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
  ]
}
