import type { NextApiRequest, NextApiResponse } from 'next'

// Normalize raw timestamp (ms or seconds) → always ms
function toMs(raw: any): number {
  if (!raw) return 0
  const n = Number(raw)
  if (isNaN(n) || n <= 0) return 0
  return n > 1e12 ? n : n * 1000
}
function msToDate(ms: number): string {
  if (!ms) return 'Unknown'
  try { return new Date(ms).toISOString().split('T')[0] } catch { return 'Unknown' }
}
function msToDays(ms: number): number {
  if (!ms) return 0
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

// Fetch real on-chain data from Tronscan API
async function getWalletData(address: string) {
  try {
    const [acctRes, txRes] = await Promise.all([
      fetch(`https://apilist.tronscanapi.com/api/account?address=${address}`),
      fetch(`https://apilist.tronscanapi.com/api/transaction?address=${address}&limit=20&start=0`)
    ])
    const acct = await acctRes.json()
    const txs  = await txRes.json()

    const trxBalance    = (acct?.balance || 0) / 1e6
    const totalTxns     = acct?.totalTransactionCount || 0
    const createdMs  = toMs(acct?.date_created)
    const created    = msToDate(createdMs)
    const agedays    = msToDays(createdMs)
    const bw            = acct?.bandwidth || {}
    const netUsed       = bw.netUsed || 0
    const freeBW        = Math.max(0, 600 - netUsed) // 600 free daily bandwidth
    const trc20s        = (acct?.trc20token_balances || []).slice(0, 5).map((t: any) => ({
      symbol:  t.tokenAbbr || t.tokenName || t.symbol,
      balance: (Number(t.balance) / Math.pow(10, t.tokenDecimal || 6)).toFixed(2),
    }))

    const txList: any[] = txs?.data || []
    const sends         = txList.filter((t: any) => t.ownerAddress === address).length
    const receives      = txList.length - sends
    const contractCalls = txList.filter((t: any) => t.contractType === 31).length

    return {
      address, trxBalance, totalTxns, created, agedays,
      freeBandwidth: freeBW,
      trc20Holdings: trc20s,
      recentActivity: { sends, receives, contractCalls, total: txList.length },
    }
  } catch { return null }
}

async function getContractData(address: string) {
  try {
    const [tokenRes, contractRes] = await Promise.all([
      fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${address}`),
      fetch(`https://apilist.tronscanapi.com/api/contract?contract=${address}`)
    ])
    const tokenData    = await tokenRes.json()
    const contractData = await contractRes.json()
    const t = tokenData?.trc20_tokens?.[0] || null
    const c = contractData?.data?.[0] || contractData || null

    return {
      address,
      verified:     !!(c?.verify_status || c?.isVerified),
      contractName: c?.name || c?.contract_name || t?.name || 'Unknown',
      creator:      c?.creator_address || c?.ownerAddress || 'Unknown',
      created:      msToDate(toMs(c?.date_created)),
      agedays:      msToDays(toMs(c?.date_created)),
      txCount:      c?.call_num || c?.trxCount || 0,
      trxBalance:   (c?.balance || 0) / 1e6,
      hasToken:     !!t,
      tokenSymbol:  t?.symbol || null,
      tokenHolders: t?.holders_count || 0,
      tokenSupply:  t ? (Number(t.totalTurnOver) / Math.pow(10, t.decimals || 6)).toFixed(0) : null,
    }
  } catch { return null }
}

// Well-known Tron token name → contract address lookup
const KNOWN_TOKENS: Record<string, string> = {
  'LDA':                    'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'LION DIGITAL ALLIANCE':  'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'LION':                   'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'LIONX':                  'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'LION X':                 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  'MANES':                  'TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d',
  'TRX':   'TNUC9Qb1rRpN8sk6By25A2dGKGpgirBSEr',
  'USDT':  'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  'USDC':  'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  'BTT':   'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4',
  'SUN':   'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S',
  'JST':   'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
}

async function getTokenData(nameOrAddress: string) {
  try {
    const upper    = nameOrAddress.trim().toUpperCase()
    const resolved = KNOWN_TOKENS[upper] || nameOrAddress.trim()
    const isAddr   = resolved.startsWith('T') && resolved.length > 30
    const url      = isAddr
      ? `https://apilist.tronscanapi.com/api/token_trc20?contract=${resolved}`
      : `https://apilist.tronscanapi.com/api/token_trc20?name=${encodeURIComponent(resolved)}&limit=5`
    const res  = await fetch(url)
    const raw  = await res.json()
    const t    = raw?.trc20_tokens?.[0] || null
    if (!t) return { found: false, query: nameOrAddress }

    // Return only the fields that are actually meaningful
    return {
      found:          true,
      name:           t.name,
      symbol:         t.symbol,
      contract:       t.contract_address,
      decimals:       t.decimals,
      holders:        t.holders_count,
      totalTransfers: t.transfer_num,
      supply:         (Number(t.totalTurnOver) / Math.pow(10, t.decimals || 6)).toFixed(0),
      volume24h:      t.volume24h || 0,
      price_trx:      t.price_trx || 0,
      price_usd:      t.price || 0,
      marketCapUsd:   t.market_cap_usd || 0,
      transfers24h:   t.transfer24h || 0,
      issued:         msToDate(toMs(t.issue_time)),
      agedays:        msToDays(toMs(t.issue_time)),
      issuer:         t.issue_address,
      website:        t.home_page,
      description:    t.token_desc,
      isListedWithPrice: !!(t.price_trx && Number(t.price_trx) > 0),
    }
  } catch { return null }
}

const SYSTEM_PROMPT = `You are an expert Tron blockchain analyst for the Lion X platform.
You ONLY use data provided to you — never invent or estimate values not in the data.
Be direct, specific, and opinionated. Reference exact numbers. No filler, no hedging.
Return ONLY valid JSON — no markdown, no text outside the JSON object.`

const TOOL_PROMPTS: Record<string, (input: string, data: any) => string> = {
  WALLET_ANALYZER: (addr, data) => `
Analyze this Tron wallet. Use ONLY the numbers provided — reference them directly in your output.

Wallet: ${addr}
Data: ${JSON.stringify(data, null, 2)}

Scoring guide:
- Score 80-100: account age >2 years AND >500 txns AND >10 TRX balance
- Score 60-79: account age >1 year OR >100 txns, moderate activity
- Score 40-59: new account (<6 months) or very low activity
- Score 0-39: brand new, empty, or suspicious patterns

Wallet type guide:
- Whale: >10,000 TRX OR >50,000 USD in tokens
- Active Trader: >1000 total txns and recent sends/receives balanced
- DeFi User: high contractCalls count in recentActivity
- Long-term Holder: old account (>2 years), low txn frequency
- New Wallet: age <90 days
- Bot/Automated: very high txn count with low TRX balance

Return ONLY this JSON:
{
  "score": <0-100 based on scoring guide above>,
  "scoreLabel": "TRUST SCORE",
  "verdict": "<emoji + verdict referencing actual age/txns e.g. '✅ 847-Day Veteran' or '⚠ 12-Day Old Wallet' or '🔴 Suspicious Pattern'>",
  "type": "<wallet type from guide>",
  "metrics": [
    {"label": "TRX Balance",  "value": "<exact trxBalance>",         "color": "#14b8a6"},
    {"label": "Total Txns",   "value": "<exact totalTxns>",          "color": "#f5a623"},
    {"label": "Wallet Age",   "value": "<exact agedays> days",       "color": "#22c55e"},
    {"label": "Tokens Held",  "value": "<count of trc20Holdings>",   "color": "#14b8a6"},
    {"label": "Recent Sends", "value": "<recentActivity.sends>",      "color": "#f5a623"},
    {"label": "Contract Calls","value": "<recentActivity.contractCalls>", "color": "#a78bfa"}
  ],
  "analysis": "<3-4 sentences. Must include: exact TRX balance, exact total transactions, exact wallet age in days, and token holdings. Be direct and opinionated.>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<specific finding with actual numbers>"}
  ]
}
Return only the JSON.`,

  CONTRACT_AUDITOR: (addr, data) => `
Audit this Tron smart contract. Use ONLY the data provided.

Contract: ${addr}
Data: ${JSON.stringify(data, null, 2)}

CRITICAL: Use the "agedays" field (integer, days old) directly. Do NOT attempt to parse the "created" string.

Scoring:
- Score 80+: verified=true AND txCount>1000 AND agedays>365
- Score 60-79: verified OR moderate activity
- Score 40-59: unverified but some activity
- Score 0-39: unverified, new, or no activity

Return ONLY this JSON:
{
  "score": <0-100 per scoring guide>,
  "scoreLabel": "SAFETY SCORE",
  "verdict": "<emoji + specific verdict e.g. '\u2705 Verified LDA Contract, 1820 Days, 2082 Txns'>",
  "type": "<TRC-20 Token | DeFi Protocol | NFT Contract | Unknown Contract>",
  "metrics": [
    {"label": "Verified",      "value": "<Yes or No>",              "color": "<#22c55e if yes, #ef4444 if no>"},
    {"label": "Contract Name", "value": "<contractName>",           "color": "#14b8a6"},
    {"label": "Tx Count",      "value": "<exact txCount>",          "color": "#f5a623"},
    {"label": "Age",           "value": "<exact agedays> days",     "color": "#22c55e"},
    {"label": "TRX Balance",   "value": "<exact trxBalance> TRX",   "color": "#14b8a6"},
    {"label": "Token Holders", "value": "<tokenHolders or N/A>",   "color": "#a78bfa"}
  ],
  "analysis": "<3-4 sentences. Must reference: verification status, exact agedays, exact txCount, exact trxBalance. Be direct.>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<specific finding with real numbers>"}
  ]
}
Return only the JSON.`,

  MARKET_INTEL: (token, data) => `
Analyze this Tron token using ONLY the data provided. Reference exact numbers. No invented metrics.

Token: ${token}
Data: ${JSON.stringify(data, null, 2)}

IMPORTANT CALCULATIONS to include in analysis:
- Transfer velocity = totalTransfers ÷ days since issued (calculate this and state it)
- If holders < 500 after >2 years: call it out as slow community growth
- If transfers24h = 0: state it directly as zero activity today
- If isListedWithPrice = false: say "Not exchange listed" — do NOT say N/A for price, say "Not Listed"

Scoring:
- 70-100: >1000 holders OR exchange listed with volume
- 50-69: 200-1000 holders, consistent transfer history
- 30-49: <200 holders, low daily velocity
- 0-29: inactive (<5 transfers/day average), near-zero holders

Return ONLY this JSON:
{
  "score": <0-100 per scoring guide>,
  "scoreLabel": "MOMENTUM SCORE",
  "verdict": "<emoji + specific verdict e.g. '📉 282 Holders, 7.5 Txns/Day Avg' or '🔥 Exchange Listed, Active Volume'>",
  "type": "<Exchange Listed | Community Token | Dormant Token | Early Stage>",
  "metrics": [
    {"label": "Holders",      "value": "<exact holders>",            "color": "#14b8a6"},
    {"label": "Total Transfers","value": "<exact totalTransfers>",   "color": "#f5a623"},
    {"label": "24h Transfers", "value": "<exact transfers24h>",       "color": "#14b8a6"},
    {"label": "Tx Velocity",   "value": "<calculated txns/day avg>",  "color": "#a78bfa"},
    {"label": "Price",         "value": "<price_usd if listed, else 'Not Listed'>", "color": "#f5a623"},
    {"label": "Token Age",     "value": "<exact years/months from issued date>", "color": "#22c55e"}
  ],
  "analysis": "<3-4 sharp sentences. Must include: exact holder count, total transfers, calculated daily velocity, token age, and honest assessment of community growth rate.>",
  "flags": [
    {"level": "ok|warn|risk", "text": "<specific factual signal with real numbers>"}
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
    const since   = Date.now() - 10 * 60 * 1000 // last 10 minutes

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
