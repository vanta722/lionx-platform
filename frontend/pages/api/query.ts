import type { NextApiRequest, NextApiResponse } from 'next'

// Fetch real on-chain data from Tronscan API
async function getWalletData(address: string) {
  try {
    const [acctRes, txRes] = await Promise.all([
      fetch(`https://apilist.tronscanapi.com/api/accountv2?address=${address}`),
      fetch(`https://apilist.tronscanapi.com/api/transaction?address=${address}&limit=20&start=0`)
    ])
    const acct = await acctRes.json()
    const txs  = await txRes.json()
    return { acct, txs }
  } catch { return null }
}

async function getContractData(address: string) {
  try {
    const [tokenRes, contractRes] = await Promise.all([
      fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${address}`),
      fetch(`https://apilist.tronscanapi.com/api/contract?contract=${address}`)
    ])
    const token    = await tokenRes.json()
    const contract = await contractRes.json()
    return { token, contract }
  } catch { return null }
}

// Well-known Tron token name → contract address lookup
const KNOWN_TOKENS: Record<string, string> = {
  'LDA':   'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'MANES': 'TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d',
  'TRX':   'TNUC9Qb1rRpN8sk6By25A2dGKGpgirBSEr',
  'USDT':  'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  'USDC':  'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  'BTT':   'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4',
  'SUN':   'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S',
  'JST':   'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
}

async function getTokenData(nameOrAddress: string) {
  try {
    const upper = nameOrAddress.trim().toUpperCase()
    // Resolve common ticker names to known contract addresses
    const resolved = KNOWN_TOKENS[upper] || nameOrAddress.trim()
    const isAddr   = resolved.startsWith('T') && resolved.length > 30
    const url      = isAddr
      ? `https://apilist.tronscanapi.com/api/token_trc20?contract=${resolved}`
      : `https://apilist.tronscanapi.com/api/token_trc20?name=${encodeURIComponent(resolved)}&limit=5`
    const res  = await fetch(url)
    const data = await res.json()
    return { ...data, resolvedAddress: isAddr ? resolved : null, inputName: nameOrAddress }
  } catch { return null }
}

const SYSTEM_PROMPT = `You are an expert Tron blockchain analyst and AI assistant for the Lion X platform.
You analyze real on-chain data and provide clear, actionable intelligence for crypto users.
Always respond with structured, accurate insights. Be direct and avoid filler.
Return ONLY valid JSON — no markdown, no explanation outside the JSON.`

const TOOL_PROMPTS: Record<string, (input: string, data: any) => string> = {
  WALLET_ANALYZER: (addr, data) => `
Analyze this Tron wallet address: ${addr}

On-chain data retrieved:
${JSON.stringify(data, null, 2)}

Return a JSON object with exactly these fields:
{
  "score": <number 0-100, higher = safer/more reputable>,
  "scoreLabel": "RISK SCORE",
  "verdict": "<emoji + short verdict e.g. '⚠ Moderate Risk' or '✓ Low Risk' or '🔴 High Risk'>",
  "type": "<wallet classification: Active Trader | Long-term Holder | DeFi User | Bot/Automated | New Wallet | Whale>",
  "metrics": [
    {"label": "TRX Balance",   "value": "<value>", "color": "#14b8a6"},
    {"label": "Token Count",   "value": "<value>", "color": "#f5a623"},
    {"label": "Total Txns",    "value": "<value>", "color": "#14b8a6"},
    {"label": "Wallet Age",    "value": "<value>", "color": "#22c55e"},
    {"label": "Avg Tx Size",   "value": "<value>", "color": "#f5a623"},
    {"label": "Rug Exposure",  "value": "<value>", "color": "#ef4444"}
  ],
  "analysis": "<3-4 sentences with key terms wrapped in <span style=\\"color:#dde8f0;font-weight:600\\">text</span>>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<finding>"}
  ]
}
Return only the JSON.`,

  CONTRACT_AUDITOR: (addr, data) => `
Audit this TRC-20 smart contract: ${addr}

Contract and token data:
${JSON.stringify(data, null, 2)}

Return a JSON object with exactly these fields:
{
  "score": <number 0-100, higher = safer>,
  "scoreLabel": "SAFETY SCORE",
  "verdict": "<emoji + verdict e.g. '✓ Relatively Safe' or '⚠ Proceed with Caution' or '🔴 High Risk'>",
  "type": "<contract type: TRC-20 Token | Meme Token | DeFi Protocol | NFT Contract | Unknown>",
  "metrics": [
    {"label": "Honeypot",    "value": "None | Detected",        "color": "<#22c55e or #ef4444>"},
    {"label": "Mint Func",   "value": "Present | None",          "color": "<#f5a623 or #22c55e>"},
    {"label": "Ownership",   "value": "Renounced | Active",      "color": "<#22c55e or #f5a623>"},
    {"label": "Verified",    "value": "Yes | No",                "color": "<#22c55e or #ef4444>"},
    {"label": "Buy Tax",     "value": "<value>%",                "color": "#14b8a6"},
    {"label": "Sell Tax",    "value": "<value>%",                "color": "#14b8a6"}
  ],
  "analysis": "<3-4 sentence audit summary with key terms highlighted>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<finding>"}
  ]
}
Return only the JSON.`,

  MARKET_INTEL: (token, data) => `
Provide market intelligence for Tron token: ${token}

Token data:
${JSON.stringify(data, null, 2)}

Return a JSON object with exactly these fields:
{
  "score": <number 0-100, market sentiment>,
  "scoreLabel": "SENTIMENT SCORE",
  "verdict": "<emoji + verdict e.g. '📈 Cautiously Bullish' or '📉 Bearish Pressure' or '➡ Neutral'>",
  "type": "<market condition: Accumulation | Distribution | Consolidation | Breakout | Decline>",
  "metrics": [
    {"label": "Holders",       "value": "<value>",          "color": "#14b8a6"},
    {"label": "Liquidity",     "value": "$<value>",         "color": "#f5a623"},
    {"label": "24h Volume",    "value": "$<value>",         "color": "#14b8a6"},
    {"label": "Buy Pressure",  "value": "Low|Med|High",     "color": "<appropriate>"},
    {"label": "Holder Trend",  "value": "<+/- %>",          "color": "<appropriate>"},
    {"label": "Supply Float",  "value": "<value>%",         "color": "#f5a623"}
  ],
  "analysis": "<3-4 sentence market intelligence with key data highlighted>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<signal>"}
  ]
}
Return only the JSON.`,
}

// ── Rate limiting: max 10 requests per IP per minute ──────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT    = 10
const RATE_WINDOW   = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now    = Date.now()
  const entry  = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }
  if (entry.count >= RATE_LIMIT) return { allowed: false, remaining: 0 }
  entry.count++
  return { allowed: true, remaining: RATE_LIMIT - entry.count }
}

// Replay protection: store used txHashes with 20-min TTL
// In-memory store (survives within a single serverless instance lifetime)
// For production scale, replace with Redis/Upstash
const usedTxHashes = new Map<string, number>()
const REPLAY_TTL_MS = 20 * 60 * 1000 // 20 minutes

function isReplay(txHash: string): boolean {
  const now = Date.now()
  // Purge expired entries
  Array.from(usedTxHashes.entries()).forEach(([hash, ts]) => {
    if (now - ts > REPLAY_TTL_MS) usedTxHashes.delete(hash)
  })
  if (usedTxHashes.has(txHash)) return true
  usedTxHashes.set(txHash, now)
  return false
}

// LDA token contract and treasury receiving address
const LDA_TOKEN     = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'
const TREASURY_ADDR = process.env.NEXT_PUBLIC_TREASURY || 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'

// Tool minimum costs (LDA) — must match frontend TOOLS array
const TOOL_COSTS: Record<string, number> = {
  WALLET_ANALYZER:  50,
  CONTRACT_AUDITOR: 100,
  MARKET_INTEL:     25,
}

// Track recently-used wallet+tool combos for replay protection (no txHash needed)
const recentWalletQueries = new Map<string, number>() // "address:tool" → timestamp
const WALLET_COOLDOWN_MS  = 5 * 60 * 1000 // 5 min cooldown per wallet per tool

// Look up the most recent LDA transfer FROM wallet TO treasury (within last 5 min)
// No txHash needed — server-side Tronscan lookup is more reliable than client-side hash
async function lookupAndVerify(
  fromWallet: string,
  tool: string
): Promise<{ valid: boolean; reason?: string; txHash?: string }> {
  try {
    const minCost = TOOL_COSTS[tool] || 25
    const since   = Date.now() - 3 * 60 * 1000 // last 3 minutes (fresh payments only)

    // Retry up to 4 times (Tronscan indexes new txs within ~10s)
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(
        `https://apilist.tronscanapi.com/api/contract/events?contract=${LDA_TOKEN}&toAddress=${TREASURY_ADDR}&limit=20`
      )
      if (!res.ok) { await new Promise(r => setTimeout(r, 3000)); continue }
      const data = await res.json()
      const events: any[] = data?.data || []
      console.log(`[lionx] attempt ${attempt}: ${events.length} events found`)

      for (const evt of events) {
        const ts     = Number(evt.timestamp || 0)
        const amount = Number(evt.amount || 0) / 1_000_000
        const from   = (evt.transferFromAddress || evt.from_address || '').toLowerCase()

        // Must be recent (within 3 minutes)
        if (ts < since) { console.log(`[lionx] skip: ts ${ts} < since ${since}`); continue }
        // Must be right amount
        if (amount < minCost) { console.log(`[lionx] skip: ${amount} LDA < ${minCost}`); continue }
        // From wallet check (case-insensitive, skip if wallet not known)
        if (fromWallet && from && from !== fromWallet.toLowerCase()) {
          console.log(`[lionx] skip: from=${from} expected=${fromWallet.toLowerCase()}`)
          continue
        }

        // Check replay
        const txHash = evt.transactionHash || `${from}-${ts}`
        if (isReplay(txHash)) { console.log(`[lionx] skip: replay ${txHash}`); continue }

        console.log(`[lionx] ✅ verified: ${from} → ${amount} LDA for ${tool}`)
        return { valid: true, txHash }
      }

      if (attempt < 4) await new Promise(r => setTimeout(r, 3500))
    }

    return { valid: false, reason: 'Payment not found — make sure you sent LDA to the treasury and try again in a few seconds' }
  } catch (e: any) {
    console.error('[lionx] verify error:', e.message)
    return { valid: false, reason: 'Verification service unavailable — please retry' }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit by IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded — max 10 queries per minute' })
  }

  const { tool, input, address } = req.body
  if (!tool || !input) return res.status(400).json({ error: 'Missing tool or input' })

  // Look up recent LDA payment on-chain — no txHash needed
  const verification = await lookupAndVerify(address || '', tool)
  if (!verification.valid) return res.status(403).json({ error: verification.reason })

  const promptFn = TOOL_PROMPTS[tool]
  if (!promptFn) return res.status(400).json({ error: 'Unknown tool' })

  try {
    // Fetch real on-chain data first
    let onChainData: any = null
    if (tool === 'WALLET_ANALYZER')  onChainData = await getWalletData(input)
    if (tool === 'CONTRACT_AUDITOR') onChainData = await getContractData(input)
    if (tool === 'MARKET_INTEL')     onChainData = await getTokenData(input)

    const prompt = promptFn(input, onChainData)

    // Call OpenRouter
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lionxeco.net',
        'X-Title': 'Lion X AI Platform',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1500,
      }),
    })

    const aiData  = await aiRes.json()
    const content = aiData.choices?.[0]?.message?.content

    if (!content) throw new Error('No AI response received')

    // Parse and return
    const parsed = JSON.parse(content)
    return res.status(200).json({ ...parsed, queriedBy: address, timestamp: Date.now() })

  } catch (e: any) {
    console.error('Query error:', e?.message)
    return res.status(500).json({ error: 'Analysis failed — please try again', detail: e?.message })
  }
}
