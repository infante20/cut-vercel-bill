// app/robots.ts
// Drop in your Next.js App Router. Blocks AI training bots + SEO scrapers
// that don't drive real traffic, while keeping Googlebot/Bingbot allowed.

import type { MetadataRoute } from 'next'

const SITE = 'https://yoursite.com'

const BLOCKED_BOTS = [
  // AI training / answer engines
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'ImagesiftBot',
  'Omgilibot',
  'FacebookBot',
  'Meta-ExternalAgent',
  'Diffbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  // SEO scrapers (zero traffic value, expensive)
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'BLEXBot',
  'DataForSeoBot',
  'PetalBot',
  'SeekportBot',
  'serpstatbot',
  'ZoominfoBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit blocks first.
      ...BLOCKED_BOTS.map((userAgent) => ({ userAgent, disallow: '/' })),
      // Everything else allowed but rate-suggested.
      // crawlDelay = honor system but Bing/Yandex respect it.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
        crawlDelay: 10,
      },
    ],
    sitemap: [`${SITE}/sitemap.xml`],
    host: SITE,
  }
}
