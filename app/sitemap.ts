import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/offer`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/refund`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/proverka-proekta-doma`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/audit-smet`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/oshibki-v-proekte-doma`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/sostav-proekta-izhs`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
  ]
}
