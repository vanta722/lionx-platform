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

async function getTokenData(nameOrAddress: string) {
  try {
    const isAddr = nameOrAddress.startsWith('T') && nameOrAddress.length > 30
    const url    = isAddr
      ? `https://apilist.tronscanapi.com/api/token_trc20?contract=${nameOrAddress}`
      : `https://apilist.tronscanapi.com/api/token_trc20?name=${nameOrAddress}&limit=5`
    const res  = await fetch(url)
    const data = await res.json()
    return data
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
const LDA_TOKEN    = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'
const TREASURY_ADDR = process.env.NEXT_PUBLIC_TREASURY || 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'

// Tool minimum costs (LDA) — must match frontend TOOLS array
const TOOL_COSTS: Record<string, number> = {
  WALLET_ANALYZER:  50,
  CONTRACT_AUDITOR: 100,
  MARKET_INTEL:     25,
}

// Verify a direct LDA transfer to treasury happened on-chain
// No smart contract needed — just a TRC-20 transfer
async function verifyBurnTx(
  txHash: string,
  expectedFrom: string,
  tool: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Retry up to 3 times — Tronscan can lag on fresh transactions
    let tx: any = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.contractRet === 'SUCCESS') { tx = data; break }
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 4000)) // wait 4s between retries
    }

    if (!tx) return { valid: false, reason: 'Transaction not found or not yet confirmed — wait a few seconds and retry' }

    // Must be confirmed
    if (tx.contractRet !== 'SUCCESS') {
      return { valid: false, reason: 'Transaction failed on-chain' }
    }

    // Must be recent (within 20 minutes)
    const txAge = Date.now() - tx.timestamp
    if (txAge > 20 * 60 * 1000) {
      return { valid: false, reason: 'Transaction too old — must be within 20 minutes' }
    }

    // Must be a TRC-20 token transfer (contractType 31)
    if (tx.contractType !== 31) {
      return { valid: false, reason: 'Not a TRC-20 transfer' }
    }

    // Extract transfer details from trc20TransferInfo
    const trc20 = tx.trc20TransferInfo?.[0]
    if (!trc20) return { valid: false, reason: 'No TRC-20 transfer data found' }

    // Must be LDA token
    if (trc20.contract_address !== LDA_TOKEN) {
      return { valid: false, reason: 'Wrong token — must send LDA' }
    }

    // Must be sent TO treasury wallet
    if (trc20.to_address !== TREASURY_ADDR) {
      return { valid: false, reason: 'Wrong destination — must send to Lion X treasury' }
    }

    // Log for debugging
    console.log(`[lionx] verify: from=${trc20.from_address} to=${trc20.to_address} amount=${trc20.amount_str} tool=${tool}`)

    // Must meet minimum tool cost — amount_str is raw (6 decimals)
    const minCost   = TOOL_COSTS[tool] || 25
    const rawAmount = trc20.amount_str || trc20.amount || '0'
    const amountLDA = Number(rawAmount) / 1_000_000
    console.log(`[lionx] amount check: raw=${rawAmount} lda=${amountLDA} need=${minCost}`)

    if (amountLDA < minCost) {
      return { valid: false, reason: `Insufficient payment — need ${minCost} LDA, received ${amountLDA.toFixed(2)} LDA` }
    }

    // from_address check removed — replay protection handles abuse

    return { valid: true }
  } catch {
    // Fail-closed — never grant free access if verification fails
    return { valid: false, reason: 'Verification service unavailable — retry shortly' }
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

  const { tool, input, address, txHash } = req.body
  if (!tool || !input) return res.status(400).json({ error: 'Missing tool or input' })

  // Require proof-of-burn: txHash from the on-chain executeQuery() call
  if (!txHash) return res.status(403).json({ error: 'Missing txHash — execute query on-chain first' })

  // Replay protection — each txHash can only be used once
  if (isReplay(txHash)) return res.status(403).json({ error: 'Transaction already used — each burn grants one query' })

  const verification = await verifyBurnTx(txHash, address, tool)
  if (!verification.valid) return res.status(403).json({ error: `Transaction invalid: ${verification.reason}` })

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
        model: 'google/gemini-flash-1.5',
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
