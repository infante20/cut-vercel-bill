// app/your-route/[slug]/page.tsx
//
// The Next.js 16 ISR fix that turns a `ƒ` (dynamic, costs you per request)
// route into a `●` (SSG, cached at edge) route.
//
// Without `generateStaticParams`, Next.js 16 IGNORES `revalidate` and treats
// the route as fully dynamic. Returning [] is the documented way to say
// "don't prerender at build time, but mark as ISR-capable on demand."

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 24h revalidate window. Stack with Cache-Control SWR in next.config.ts
// for a 30-day effective edge cache lifetime.
export const revalidate = 86400

// REQUIRED in Next.js 16 to enable ISR for dynamic routes.
// `[]` = build-time prerender nothing, render-and-cache on first request.
export const dynamicParams = true

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return []
}

interface Props {
  params: Promise<{ slug: string }>
}

// Your actual data fetcher. Swap with Supabase, Prisma, Drizzle, fetch, etc.
// Important: do NOT use cookies() / headers() in the render path — they
// opt the page out of static generation and you're back to ƒ.
async function getRecord(slug: string) {
  // Example with raw fetch (caches automatically in Next.js):
  const res = await fetch(`https://your-api.example.com/items/${slug}`, {
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const record = await getRecord(slug)
  if (!record) return {}
  return {
    title: `${record.name} | Your Site`,
    description: record.description,
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const record = await getRecord(slug)

  if (!record) notFound()

  return (
    <article>
      <h1>{record.name}</h1>
      <p>{record.description}</p>
      {/*
        Verify ISR is working:
          - Run `next build` and check the output legend.
            Want: `● /your-route/[slug]`
            Bad:  `ƒ /your-route/[slug]`
          - Open the deployed URL in Chrome Incognito, hit reload.
            Second load Response Headers should show:
              x-vercel-cache: HIT
      */}
    </article>
  )
}
