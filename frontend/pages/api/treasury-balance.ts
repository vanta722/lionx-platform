import type { NextApiRequest, NextApiResponse } from 'next'

const TREASURY   = 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'
const LDA_TOKEN  = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const r = await fetch(
      `https://apilist.tronscanapi.com/api/account?address=${TREASURY}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return res.status(502).json({ balance: 0, error: `Tronscan ${r.status}` })
    const data = await r.json()
    const tokens: any[] = data?.trc20token_balances || []
    const entry = tokens.find(t => t.tokenAbbr === 'LDA' || t.tokenId === LDA_TOKEN)
    const balance = entry ? Number(entry.balance) / 1e6 : 0
    return res.status(200).json({ balance })
  } catch (e: any) {
    return res.status(200).json({ balance: 0, error: e?.message })
  }
}
