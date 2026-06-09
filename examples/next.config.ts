// next.config.ts
// Extends the CDN cache window for ISR routes. Combined with the page-level
// `revalidate` + `generateStaticParams` in page.tsx, bot hits to cached
// slugs serve from edge for ~$0.

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // ISR pages revalidate every 24h. SWR=30d means even after the 24h
        // window, edge serves stale HTML instantly while regenerating.
        source: '/your-route/:slug',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=2592000',
          },
        ],
      },
      // Sitemap chunks get hammered by crawlers — cache long.
      {
        source: '/your-route/sitemap/:chunk',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=2592000',
          },
        ],
      },
    ]
  },
}

export default nextConfig
