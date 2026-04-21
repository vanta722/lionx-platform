import type { NextApiRequest, NextApiResponse } from 'next'

const TREASURY  = 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'
const LDA_TOKEN = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'
const KV_KEY    = 'lionx:treasury:balance'
const CACHE_TTL = 60 // seconds

async function kvGet(url: string, token: string, key: string): Promise<number | null> {
  try {
    const r = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    const d = await r.json()
    return d?.result ? Number(d.result) : null
  } catch { return null }
}

async function kvSet(url: string, token: string, key: string, value: number) {
  try {
    await fetch(`${url}/set/${key}/${value}?ex=${CACHE_TTL}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
  } catch { /* best-effort */ }
}

async function fetchFromTronscan(): Promise<number | null> {
  try {
    const r = await fetch(
      `https://apilist.tronscanapi.com/api/account?address=${TREASURY}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!r.ok) return null
    const data   = await r.json()
    const tokens: any[] = data?.trc20token_balances || []
    const entry  = tokens.find(t => t.tokenAbbr === 'LDA' || t.tokenId === LDA_TOKEN)
    return entry ? Number(entry.balance) / 1e6 : null
  } catch { return null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*') // public read-only data — safe to expose
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const kvUrl   = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  // 1. Try KV cache first (shared across all Vercel instances)
  if (kvUrl && kvToken) {
    const cached = await kvGet(kvUrl, kvToken, KV_KEY)
    if (cached !== null) {
      return res.status(200).json({ balance: cached, cached: true })
    }
  }

  // 2. Cache miss — fetch live from Tronscan
  const live = await fetchFromTronscan()

  if (live !== null) {
    // Store in KV for next 60s
    if (kvUrl && kvToken) await kvSet(kvUrl, kvToken, KV_KEY, live)
    return res.status(200).json({ balance: live })
  }

  // 3. Tronscan failed and no cache — return known floor value
  return res.status(200).json({ balance: 125.052703, stale: true })
}
