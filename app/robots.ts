import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const allowPublic = {
  allow: '/',
  disallow: ['/report/', '/chat/', '/api/'],
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', ...allowPublic },
      { userAgent: 'GPTBot', ...allowPublic },
      { userAgent: 'ClaudeBot', ...allowPublic },
      { userAgent: 'PerplexityBot', ...allowPublic },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
