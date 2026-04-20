import type { NextApiRequest, NextApiResponse } from 'next'

const TOOL_PROMPTS: Record<string, (input: string) => string> = {
  WALLET_ANALYZER: (addr) => `
You are a Tron blockchain analyst. Analyze wallet address: ${addr}
Fetch data from Tronscan and return a JSON analysis with these exact fields:
- score: risk score 0-100 (0=risky, 100=safe)
- scoreLabel: "RISK SCORE"
- verdict: one line verdict e.g. "⚠ Moderate Risk" or "✓ Low Risk"
- type: wallet type e.g. "Active Trader", "Long-term Holder", "Bot"
- metrics: array of {label, value, color} objects (6 items: TRX Balance, Token Count, Total Txns, Wallet Age, Avg Tx Size, Rug Exposure)
- analysis: 3-4 sentence AI analysis with key words wrapped in <span style="color:#dde8f0;font-weight:600">text</span>
- flags: array of {level:"ok"|"warn"|"risk", text} items (5 items)
Return valid JSON only.`,

  CONTRACT_AUDITOR: (addr) => `
You are a smart contract security auditor. Audit TRC-20 contract: ${addr}
Return a JSON analysis with:
- score: safety score 0-100 (100=safe)
- scoreLabel: "SAFETY SCORE"
- verdict: e.g. "✓ Relatively Safe" or "⚠ High Risk"
- type: "TRC-20 Token" or specific type
- metrics: array of {label, value, color} (6 items: Honeypot, Mint Function, Ownership, Verified, Buy Tax, Sell Tax)
- analysis: 3-4 sentence audit summary with key terms highlighted
- flags: array of {level:"ok"|"warn"|"risk", text} (6 items)
Return valid JSON only.`,

  MARKET_INTEL: (token) => `
You are a crypto market analyst. Analyze token: ${token} on Tron blockchain.
Return a JSON analysis with:
- score: sentiment score 0-100
- scoreLabel: "SENTIMENT SCORE"
- verdict: e.g. "📈 Cautiously Bullish"
- type: market trend e.g. "Accumulation", "Distribution", "Neutral"
- metrics: array of {label, value, color} (6 items: Holders, Liquidity, 24h Vol, Buy Pressure, Holder Trend, Supply Float)
- analysis: 3-4 sentence market intelligence summary
- flags: array of {level:"ok"|"warn"|"risk", text} (5 items)
Return valid JSON only.`,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tool, input, address } = req.body
  if (!tool || !input) return res.status(400).json({ error: 'Missing tool or input' })

  const prompt = TOOL_PROMPTS[tool]
  if (!prompt) return res.status(400).json({ error: 'Unknown tool' })

  try {
    // Call OpenRouter AI
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
        messages: [{ role: 'user', content: prompt(input) }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    const data    = await aiRes.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) throw new Error('No AI response')

    const parsed = JSON.parse(content)
    return res.status(200).json(parsed)
  } catch (e: any) {
    console.error('Query API error:', e)
    return res.status(500).json({ error: 'AI query failed — please try again' })
  }
}
