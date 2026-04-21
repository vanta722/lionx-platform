import type { NextApiRequest, NextApiResponse } from 'next'

const TREASURY  = 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'
const LDA_TOKEN = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'

// In-memory cache — survives within the same serverless instance
// Prevents flaky Tronscan responses from showing 0 to the user
let cachedBalance = 125.052703  // seed with known value so first render is never 0
let cacheTime     = 0
const CACHE_TTL   = 60_000     // 60s — refresh at most once per minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const now = Date.now()

  // Return cached value if fresh enough
  if (cacheTime && now - cacheTime < CACHE_TTL) {
    return res.status(200).json({ balance: cachedBalance, cached: true })
  }

  try {
    const r = await fetch(
      `https://apilist.tronscanapi.com/api/account?address=${TREASURY}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!r.ok) throw new Error(`Tronscan ${r.status}`)
    const data   = await r.json()
    const tokens: any[] = data?.trc20token_balances || []
    const entry  = tokens.find(t => t.tokenAbbr === 'LDA' || t.tokenId === LDA_TOKEN)
    const balance = entry ? Number(entry.balance) / 1e6 : cachedBalance

    // Only update cache if we got a real value
    if (entry) {
      cachedBalance = balance
      cacheTime     = now
    }

    return res.status(200).json({ balance })
  } catch {
    // Tronscan flaked — return last known good value instead of 0
    return res.status(200).json({ balance: cachedBalance, cached: true, stale: true })
  }
}
