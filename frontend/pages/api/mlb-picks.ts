import type { NextApiRequest, NextApiResponse } from 'next'
import TronWeb from 'tronweb'

// ─── Shared KV / auth utilities (mirrors query.ts pattern) ───────────────────

const kvUrl   = process.env.KV_REST_API_URL
const kvToken = process.env.KV_REST_API_TOKEN

if (!kvUrl || !kvToken) {
  console.error('[lionx:mlb] WARNING: KV not configured. Replay protection is instance-local only.')
}

function tronscanFetch(url: string): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  const headers: Record<string, string> = {}
  if (process.env.TRONSCAN_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRONSCAN_API_KEY
  return fetch(url, { signal: ctrl.signal, headers }).finally(() => clearTimeout(timer))
}

const RATE_LIMIT  = 10
const RATE_WINDOW = 60

async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const key = `lionx:rl:${ip}`
  try {
    const incrRes  = await fetch(`${kvUrl}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    })
    const incrData = await incrRes.json()
    const count    = Number(incrData?.result ?? RATE_LIMIT + 1)
    if (count === 1) {
      await fetch(`${kvUrl}/expire/${encodeURIComponent(key)}/${RATE_WINDOW}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      })
    }
    return { allowed: count <= RATE_LIMIT }
  } catch {
    return { allowed: true } // fail open on KV error
  }
}

async function isReplay(txHash: string): Promise<boolean> {
  try {
    const key    = `lionx:used:${txHash}`
    const setRes = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}/1/ex/1200/nx`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    })
    const setData = await setRes.json()
    return setData?.result !== 'OK'
  } catch (e) {
    console.error('[lionx:mlb] KV replay-check error — rejecting to be safe:', e)
    return true // fail closed on KV error
  }
}

async function checkWalletCooldown(address: string, tool: string): Promise<boolean> {
  const key = `lionx:cd:${address}:${tool}`
  try {
    const setRes  = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}/1/ex/300/nx`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    })
    const setData = await setRes.json()
    return setData?.result !== 'OK' // true = on cooldown
  } catch {
    return false // fail open on KV error
  }
}

const LDA_TOKEN     = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'
const TREASURY_ADDR = process.env.NEXT_PUBLIC_TREASURY || 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'
const MLB_COST      = 75

async function lookupAndVerify(
  fromWallet: string,
): Promise<{ valid: boolean; reason?: string; txHash?: string }> {
  try {
    const since = Date.now() - 10 * 60 * 1000 // last 10 minutes

    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await tronscanFetch(
        `https://apilist.tronscanapi.com/api/contract/events?contract=${LDA_TOKEN}&toAddress=${TREASURY_ADDR}&limit=20`
      )
      if (!res.ok) { await new Promise(r => setTimeout(r, 3000)); continue }

      const data          = await res.json()
      const events: any[] = data?.data || []
      console.log(`[lionx:mlb] attempt ${attempt}: ${events.length} events found`)

      for (const evt of events) {
        const ts     = Number(evt.timestamp || 0)
        const amount = Number(evt.amount || 0) / 1_000_000
        const from   = (evt.transferFromAddress || evt.from_address || '').toLowerCase()

        if (ts < since) continue
        if (amount < MLB_COST) continue
        if (fromWallet && from && from !== fromWallet.toLowerCase()) continue

        const to = (evt.transferToAddress || evt.to_address || '').toLowerCase()
        if (!to || to !== TREASURY_ADDR.toLowerCase()) continue

        const txHash = evt.transactionHash || `${from}-${ts}`
        if (await isReplay(txHash)) { console.log(`[lionx:mlb] skip: replay ${txHash}`); continue }

        console.log(`[lionx:mlb] ✅ verified: ${from} → ${amount} LDA for MLB_PICKS`)
        return { valid: true, txHash }
      }

      if (attempt < 4) await new Promise(r => setTimeout(r, 3500))
    }

    return { valid: false, reason: 'Payment not found — send 75 LDA to treasury and try again in a few seconds' }
  } catch (e: any) {
    console.error('[lionx:mlb] verify error:', e.message)
    return { valid: false, reason: 'Verification service unavailable — please retry' }
  }
}

// ─── MLB Picks logic ──────────────────────────────────────────────────────────

// Fallback mock picks used when ODDS_API_KEY is not configured
const MOCK_PICKS = `PICK 1: New York Mets ML (-115) | 1.5u
Edge: Fade the public — 78% of bets on Cubs while Mets send ace with 3.12 ERA vs Chicago's bullpen (5.1 ERA last 7 days)

PICK 2: Under 8.5 Padres/Dodgers (-110) | 1u
Edge: Both starters trending under with combined 2.8 ERA over last 4 starts; marine layer at Dodger Stadium suppresses offense

Record: NEW
Confidence: HIGH (Pick 1) | MEDIUM (Pick 2)`

function isOddsKeyPlaceholder(): boolean {
  const k = process.env.ODDS_API_KEY || ''
  return !k || k.startsWith('get_free_key') || k.startsWith('placeholder') || k === ''
}

async function fetchMlbOdds(): Promise<{ games: any[]; raw: string }> {
  if (isOddsKeyPlaceholder()) {
    console.log('[lionx:mlb] ODDS_API_KEY not set — will use mock picks')
    return { games: [], raw: '' }
  }

  const url  = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,totals&oddsFormat=american`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) {
      console.error(`[lionx:mlb] Odds API error: ${res.status}`)
      return { games: [], raw: '' }
    }
    const data  = await res.json()
    const games = Array.isArray(data) ? data : []
    // Summarise to keep the OpenAI prompt concise (home/away teams + all markets)
    const summary = games.slice(0, 15).map((g: any) => ({
      home:    g.home_team,
      away:    g.away_team,
      time:    g.commence_time,
      markets: (g.bookmakers?.[0]?.markets || []).map((m: any) => ({
        key:      m.key,
        outcomes: m.outcomes,
      })),
    }))
    return { games, raw: JSON.stringify(summary) }
  } catch (e) {
    clearTimeout(timer)
    console.error('[lionx:mlb] Odds API fetch failed:', e)
    return { games: [], raw: '' }
  }
}

const MLB_SYSTEM_PROMPT = `You are a sharp MLB betting analyst. You pick maximum 2 conviction bets per day — moneyline or team totals only. You favor: fading heavy public chalk, pitcher ERA/FIP edges, team totals based on bullpen matchups. Never pick both sides of a game. Format each pick EXACTLY as:

PICK 1: [Team] [Bet Type] ([Odds]) | [Units]u
Edge: [one line reason — pitcher matchup OR public fade OR total angle]

PICK 2: [Team] [Bet Type] ([Odds]) | [Units]u
Edge: [one line reason]

Record: [track from memory or say NEW if first pick]
Confidence: HIGH | MEDIUM for each pick`

async function generateMlbPicks(gamesRaw: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

  const userMsg = gamesRaw
    ? `Here are today's MLB games with odds:\n\n${gamesRaw}\n\nGive me your 2 top conviction picks for today.`
    : `No live odds available today. Based on typical MLB matchup analysis, provide 2 example conviction picks with realistic odds to illustrate your format.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      messages:    [
        { role: 'system', content: MLB_SYSTEM_PROMPT },
        { role: 'user',   content: userMsg },
      ],
      temperature: 0.4,
      max_tokens:  500,
    }),
  })

  const data    = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('No response from AI')
  return content.trim()
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://lion-xai.com',
  'https://www.lion-xai.com',
  'https://frontend-phi-blond-32.vercel.app',
]

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS
  const origin = req.headers.origin || ''
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (origin) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit by IP
  const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const rateCheck = await checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded — max 10 queries per minute' })
  }

  const { address, sig, nonce } = req.body

  if (!address || !sig || !nonce) {
    return res.status(400).json({ error: 'Missing required fields: address, sig, nonce' })
  }

  // Validate Tron address format
  if (!/^T[A-Za-z0-9]{33}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' })
  }

  // Verify wallet ownership via signed nonce
  try {
    const nonceTs = parseInt((nonce as string).split(':')[2] || '0', 10)
    if (Date.now() - nonceTs > 3 * 60 * 1000) {
      return res.status(400).json({ error: 'Signature expired — please try again' })
    }
    const tw        = new TronWeb({ fullHost: 'https://api.trongrid.io' })
    const recovered = await tw.trx.verifyMessageV2(nonce as string, sig as string)
    if (recovered?.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: 'Signature mismatch — wallet ownership not verified' })
    }
  } catch (e: any) {
    console.error('[lionx:mlb] sig verify error:', e?.message)
    return res.status(400).json({ error: 'Signature verification failed — please try again' })
  }

  // Verify 75 LDA payment to treasury
  const verification = await lookupAndVerify(address)
  if (!verification.valid) return res.status(403).json({ error: verification.reason })

  // Per-wallet cooldown (5 min)
  const onCooldown = await checkWalletCooldown(address, 'MLB_PICKS')
  if (onCooldown) {
    return res.status(429).json({ error: 'Please wait 5 minutes before fetching picks again' })
  }

  try {
    let picks: string
    let gamesAnalyzed: number

    if (isOddsKeyPlaceholder()) {
      // No API key configured — return mock picks so the tool still works in dev
      picks         = MOCK_PICKS
      gamesAnalyzed = 0
    } else {
      const { games, raw } = await fetchMlbOdds()
      gamesAnalyzed        = games.length
      picks                = games.length > 0
        ? await generateMlbPicks(raw)
        : MOCK_PICKS
    }

    return res.status(200).json({
      picks,
      gamesAnalyzed,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[lionx:mlb] picks generation error:', e?.message)
    return res.status(500).json({ error: 'Failed to generate picks — please try again' })
  }
}
