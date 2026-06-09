# Cut your Vercel bill 67% in one afternoon

Real playbook from a Next.js 16 side project that was projected at **~$70/mo** for ~$0 in revenue. Brought it down to **~$22/mo** without touching the product.

The full breakdown of what was costing money, why, and the exact steps to fix it. Copy-paste-ready code examples in [`examples/`](./examples).

---

## Was this you?

- Side project on Vercel Pro with a Next.js dynamic route (`/products/[id]`, `/users/[handle]`, etc.)
- Monthly bill quietly climbing past what your revenue justifies
- You don't know why because Vercel's UI hides the breakdown
- Suspicion that bots are involved but no confirmation

If yes, read on. The diagnosis takes 5 minutes. The fixes take ~1 hour total.

---

## TL;DR — where my $70/mo went

| Line item | Before | After |
|---|---|---|
| Observability Events | $33/mo | $0 |
| Function Invocations + CPU | ~$15/mo | <$1/mo |
| Axiom Log Drain (replacement) | $0 | ~$4/mo |
| Pro plan (fixed) | $20/mo | $20/mo |
| **Total** | **~$68/mo** | **~$22/mo** |

The single biggest line was Observability Plus — a paid tier most Pro users don't realize they have on. Second biggest was bot scrapers hammering one dynamic route that **should have been cached but wasn't** (Next.js 16 changed the caching rules).

---

## Step 0 — Diagnose before touching anything

**Don't optimize what doesn't move the needle.** Start with the CSV:

1. Vercel → Settings → Billing → **Download usage CSV**
2. Open in a spreadsheet, group by `Metric` + `ProjectId`, sum `Charges (USD)`
3. The top 2-3 line items will explain 90%+ of your bill

Then check for scrapers:

1. Vercel → Project → Logs, filter to the last hour
2. Look for the same path pattern hit at >1 req/sec from varied IPs
3. Bonus tell: slugs/IDs walking alphabetically or sequentially

If you see this, you're being scraped. In my case it was 4-6 req/sec sustained on a high-cardinality `[slug]` route — slugs marching alphabetically. A scraper was harvesting a public dataset I had cleaned up and indexed.

---

## Step 1 — Turn off Observability Plus

Do this even if you skip everything else. **Saved me $33/mo.**

```
Project → Settings → Observability → toggle Plus OFF
```

Basic logs stay free on Pro. Plus only matters if you actively query observability data daily, which most side projects don't.

---

## Step 2 — Replace it with Axiom (optional, ~$4/mo for queryable logs)

Free tier gives 500 GB/mo + 30 days retention. Way cheaper than Observability Plus and lets you actually SQL-query logs.

1. Sign up at [app.axiom.co](https://app.axiom.co)
2. Create a dataset
3. In Vercel: install the [Axiom integration](https://vercel.com/integrations/axiom), select project, authorize
4. Wait 2-3 min for data to flow

Vercel charges $0.50/GB to forward logs. ~7.5 GB/mo for my traffic = $3.75/mo. Drop in the bucket vs $33/mo Observability Plus.

Useful APL queries to identify the scraper:

```kusto
['vercel']
| where _time > ago(60m)
| summarize hits = count() by ["path"]
| top 20 by hits
```

```kusto
['vercel']
| where _time > ago(60m)
| summarize hits = count() by ["request.userAgent"]
| top 20 by hits
```

---

## Step 3 — Block AI / SEO scrapers in `robots.ts`

Honor system, but respectable bots actually obey. See [`examples/robots.ts`](./examples/robots.ts) for the full file.

Key idea: explicitly deny AI training bots (GPTBot, ClaudeBot, CCBot, etc.) and SEO scrapers (AhrefsBot, SemrushBot, MJ12bot) — none of them drive real traffic but they cost CPU. **Keep Googlebot and Bingbot allowed** — those do drive traffic.

---

## Step 4 — Vercel Firewall (the real enforcement)

`robots.txt` is honor system. Firewall actually blocks. Three rules.

### 4a — Custom Rule: Block bot user-agents

Firewall → Add Rule → Custom Rule. Vercel has a natural-language rule generator:

> "Block requests where User-Agent header contains any of: GPTBot, ClaudeBot, CCBot, PerplexityBot, Bytespider, AhrefsBot, SemrushBot, MJ12bot, BLEXBot, DataForSeoBot, anthropic-ai, Google-Extended, Meta-ExternalAgent"

Action: **Deny**.

### 4b — Rate Limit on your scraper-target route

For high-cardinality dynamic routes, rate-limit per IP. Real users browse 5-20 of these per minute max; scrapers do hundreds.

- If: Request Path matches regex `^/your-route/[^/]+$`
- Rate Limit: **30 req / 60 sec per IP Address**
- Action: **Deny 403, persistent block 15 minutes**

This catches simple scrapers. **Won't catch ones with rotating proxies.** For those, step 4c.

### 4c — Bot Protection + AI Bots toggles (FREE on Pro, the game-changer)

Firewall → Bot Management section:

- **Bot Protection: ON** — uses JA4 TLS fingerprints + behavioral heuristics. Catches scrapers that rotate IPs but still use headless Chromium/Puppeteer. **This is what finally killed my bot.**
- **AI Bots: ON** — Vercel's managed list, enforces what robots.txt asks nicely.

Vercel recommends "Start With Logging" first. If you're bleeding money, "Turn On Anyway" — verified bots like Googlebot keep working, normal browsers unaffected, only suspicious clients challenged.

**Result:** my bot traffic dropped from ~460 req/min to ~3 req/min in under 90 seconds.

---

## Step 5 — Fix Next.js 16 ISR (this one cost me hours)

**Next.js 16 changed the caching model.** `export const revalidate = N` no longer auto-enables ISR for dynamic routes. You also need `generateStaticParams`. Without it, every request hits your function and your database.

### Build output legend

| Symbol | Meaning |
|---|---|
| `●` | SSG, cached at the edge |
| `◐` | ISR |
| `ƒ` | **Dynamic — function invoked every request** |

If your `[slug]` route shows `ƒ`, you're paying for every bot hit. Even with `export const revalidate = 86400` declared.

### The fix

In `app/your-route/[slug]/page.tsx`:

```ts
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return [] // don't prerender at build time, mark as ISR-capable
}
```

Returning `[]` tells Next.js: "don't prerender any at build, but cache each slug on first request." Each unique URL renders once, then serves from CDN for 24h. See [`examples/page.tsx`](./examples/page.tsx) for a full example.

After this, `next build` should show `● /your-route/[slug]` instead of `ƒ`.

**Gotcha:** This only works on pages that **don't use `searchParams`**. Pages with query string variations (`?page=2&filter=foo`) can't be cleanly ISR'd — each combo is a different cache key.

---

## Step 6 — Cache-Control headers (belt + suspenders)

In `next.config.ts`, extend the CDN cache window. See [`examples/next.config.ts`](./examples/next.config.ts) for the full file.

`stale-while-revalidate=30d` means after the 24h revalidate window, the CDN serves stale HTML instantly while regenerating in the background. **Bot hits become $0.**

---

## How to verify each step worked

| Check | How |
|---|---|
| `robots.ts` deployed | `curl https://yoursite.com/robots.txt` — see your bot list |
| Firewall rules active | Firewall → Custom Rules, toggle ON, Denied count rising |
| Bot Protection working | Firewall overview graph spikes on denials/challenges |
| ISR working | Chrome Incognito, DevTools → Network, second load: `x-vercel-cache: HIT` |
| Costs actually dropping | Wait 24-48h, check Vercel → Usage → Daily breakdown |

---

## Bonus lessons (worth more than the dollar savings)

1. **Your sitemap is an invitation.** Every URL listed will be crawled. If you publish hundreds of thousands of URLs across sitemap chunks, expect that many crawls per scraper per cycle. Only list URLs you'd pay to have crawled.

2. **`x-vercel-region: sin1` doesn't mean the bot is in Singapore.** It's the Vercel edge that served the request. The client could be anywhere in Asia.

3. **Old/fake user agents are a tell.** A request claiming `Mozilla/5.0 (Macintosh; U; PPC Mac OS X)` in 2026 is a lazy scraper. Real browsers update.

4. **Diagnose the CSV first, not the bot.** I almost spent a day bot-hunting before realizing Observability Plus alone was $33/mo. Look at spend before architecting solutions.

5. **A scraper costs you twice.** Once in compute, once in stolen IP. Whatever data they harvested — they'll either resell it as leads, republish it on a competing site, or feed it to an LLM. The economic value of preventing scraping is much larger than the Vercel bill.

---

## License

MIT — copy, modify, share, post on Reddit, whatever. No attribution required.

If this saved you money, a star helps others find it. That's it.
