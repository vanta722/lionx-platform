import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'
import Link from 'next/link'

// ── Contract addresses ──────────────────────────────────────────
const LDA_ADDR   = process.env.NEXT_PUBLIC_PLATFORM    || ''
const MIGRATION_ADDR = process.env.NEXT_PUBLIC_MIGRATION || ''
const TREASURY_ADDR  = process.env.NEXT_PUBLIC_TREASURY  || '' // treasury wallet (set NEXT_PUBLIC_TREASURY in env)
const LDA_SUPPLY = 20_207_717 // LDA total supply
// LDA supply is fixed — no new tokens minted
const BURN_PERCENT = 70 // 70% burned per query, 30% treasury

interface LiveStats {
  // Burn stats
  platformActive:      boolean
  timeRemaining:      number   // seconds
  totalSpent:     number   // total LDA spent on queries
  totalBurned:    number   // total LDA burned
  circulatingSupply: number   // supply minus burned
  remainingSupply:  number   // remaining supply
  // Token stats
  totalSupply:      number   // total LDA minted so far
  burnedSupply:      number   // total burned by platform
  circulating:      number   // totalSupply - burnedSupply
  treasuryBalance:    number   // treasury wallet LDA holdings
  // Platform stats
  holders:            number
  burnRate24h:        number   // LDA burned in last 24h (approx)
  // Derived
  burnedPct:      number   // % of supply burned
  burnPct:            number   // % of supply burned
  supplyCreatedPct:   number   // % of max 10M that exists
}

// Seed with confirmed on-chain data — API updates will overwrite
const KNOWN_BURNED = 1_050_000  // confirmed in Tron black hole TLsV52s...

const DEFAULT_STATS: LiveStats = {
  platformActive:    true,
  timeRemaining:     0,
  totalSpent:        KNOWN_BURNED,
  totalBurned:       KNOWN_BURNED,
  circulatingSupply: LDA_SUPPLY - KNOWN_BURNED,
  remainingSupply:   LDA_SUPPLY,
  totalSupply:       LDA_SUPPLY,
  burnedSupply:      KNOWN_BURNED,
  circulating:       LDA_SUPPLY - KNOWN_BURNED,
  treasuryBalance:   0,
  holders:           281,
  burnRate24h:       KNOWN_BURNED,
  burnedPct:         (KNOWN_BURNED / LDA_SUPPLY) * 100,
  burnPct:           (KNOWN_BURNED / LDA_SUPPLY) * 100,
  supplyCreatedPct:  (KNOWN_BURNED / LDA_SUPPLY) * 100,
}

interface BurnEvent {
  id: string; wallet: string; tool: string; amount: number; burned: number; time: string
}

const TOOL_NAMES: Record<string, string> = {
  WALLET_ANALYZER: '🔍 Wallet Analyzer',
  CONTRACT_AUDITOR: '🛡️ Contract Auditor',
  MARKET_INTEL: '📊 Market Intel',
}

function MiniChart({ data, color, label }: { data: number[], color: string, label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width = c.offsetWidth, H = c.height = c.offsetHeight
    const max = Math.max(...data, 1), min = Math.min(...data)
    const range = max - min || 1
    const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - ((v - min) / range) * (H - 10) - 5 }))
    ctx.clearRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '00')
    ctx.beginPath(); ctx.moveTo(pts[0].x, H)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length-1].x, H); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke()
  }, [data, color])
  return <canvas ref={ref} className="w-full" style={{ height: 60 }}/>
}

function Countdown({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const unit = (v: number, l: string) => (
    <div className="text-center">
      <div className="font-black text-2xl font-mono" style={{ color: seconds < 86400 ? '#ef4444' : '#f5a623' }}>
        {String(v).padStart(2,'0')}
      </div>
      <div className="text-xs" style={{ color: '#4a5a6a' }}>{l}</div>
    </div>
  )
  return (
    <div className="flex gap-3 items-center">
      {unit(d,'Days')}<span style={{color:'#4a5a6a',fontSize:18,fontWeight:'bold'}}>:</span>
      {unit(h,'Hrs')}<span style={{color:'#4a5a6a',fontSize:18,fontWeight:'bold'}}>:</span>
      {unit(m,'Min')}<span style={{color:'#4a5a6a',fontSize:18,fontWeight:'bold'}}>:</span>
      {unit(s,'Sec')}
    </div>
  )
}

export default function Dashboard() {
  const { address, balance, connected } = useWallet()
  const [stats,   setStats]   = useState<LiveStats>(DEFAULT_STATS)
  const [burns,   setBurns]   = useState<BurnEvent[]>([])
  const [newBurn, setNewBurn] = useState(false)
  const [tick,    setTick]    = useState(0)
  const [burnHistory,  setBurnHistory]  = useState([0,0,0,0,0,0,0,0,0,0,0,0])
  const [issueHistory, setIssueHistory] = useState([0,0,0,0,0,0,0,0,0,0,0,0])

  // ── Fetch live stats from Tronscan (black hole = real burned LDA) ──
  const BLACK_HOLE = 'TLsV52sRDL79HXGGm9yzwKibb6BeruhUzy' // 1,050,000+ LDA confirmed burned
  async function fetchLiveStats() {
    try {

      // Use /api/account on black hole — trc20token_balances has exact LDA balance
      const [tokenRes, burnAccountRes] = await Promise.all([
        fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1`),
        fetch(`https://apilist.tronscanapi.com/api/account?address=${BLACK_HOLE}`),
      ])
      const tokenData       = await tokenRes.json()
      const burnAccountData = await burnAccountRes.json()

      const token      = tokenData?.trc20_tokens?.[0]
      const holders    = Number(token?.holder_count || 281)
      const totalSupply = Number(token?.total_supply_with_decimals || 0) / 1e6 || LDA_SUPPLY

      // Find LDA in black hole's token balances
      const ldaEntry   = burnAccountData?.trc20token_balances?.find(
        (t: any) => t.tokenId === 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'
      )
      const totalBurned = ldaEntry ? Number(ldaEntry.balance) / 1e6 : 1_050_000
      const circulating = totalSupply - totalBurned

      let treasuryBal = 0
      if (TREASURY_ADDR) {
        const tRes = await fetch(`https://apilist.tronscanapi.com/api/account/tokens?address=${TREASURY_ADDR}&token=TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1`)
        const tData = await tRes.json()
        treasuryBal = Number(tData?.data?.[0]?.quantity || 0) / 1e6
      }

      const s: LiveStats = {
        platformActive:    true,
        timeRemaining:     0,
        totalSpent:        totalBurned,
        totalBurned,
        circulatingSupply: circulating,
        remainingSupply:   LDA_SUPPLY,
        totalSupply,
        burnedSupply:      totalBurned,
        circulating,
        treasuryBalance:   treasuryBal,
        holders,
        burnRate24h:       totalBurned,
        burnedPct:         (totalBurned / LDA_SUPPLY) * 100,
        burnPct:           (totalBurned / LDA_SUPPLY) * 100,
        supplyCreatedPct:  (totalBurned / LDA_SUPPLY) * 100,
      }

      setStats(s)
      setBurnHistory(h => [...h.slice(1), totalBurned])
      setIssueHistory(h => [...h.slice(1), totalBurned])
    } catch (e) {
      // TronLink not connected — show defaults
    }
  }

  useEffect(() => {
    fetchLiveStats()
    const interval = setInterval(fetchLiveStats, 15000)
    return () => clearInterval(interval)
  }, [])

  // ── Live countdown ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setStats(s => ({ ...s, timeRemaining: Math.max(0, s.timeRemaining - 1) }))
      setTick(n => n + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // ── Real burn events from Tronscan (QueryExecuted events on Platform contract) ──
  const PLATFORM_ADDR = process.env.NEXT_PUBLIC_PLATFORM || 'TYKu4AJv6cqNwoyZtnjzpsyE9Tf5WkLQhh'
  const TOOL_NAMES: Record<string, string> = {
    'WALLET_ANALYZER':  'WALLET_ANALYZER',
    'CONTRACT_AUDITOR': 'CONTRACT_AUDITOR',
    'MARKET_INTEL':     'MARKET_INTEL',
  }
  const TOOL_COSTS: Record<string, number> = { WALLET_ANALYZER:50, CONTRACT_AUDITOR:100, MARKET_INTEL:25 }

  useEffect(() => {
    let lastSeen = new Set<string>()

    async function pollBurnEvents() {
      try {
        const res  = await fetch(
          `https://apilist.tronscanapi.com/api/contract/events?address=${PLATFORM_ADDR}&event_name=QueryExecuted&limit=20`
        )
        const data = await res.json()
        const events = data?.data || []
        if (!events.length) return

        const newEvents: BurnEvent[] = []
        for (const ev of events) {
          const txHash = ev.transaction_id || ev.transactionId
          if (!txHash || lastSeen.has(txHash)) continue
          lastSeen.add(txHash)

          // Decode event params
          const toolHex = ev.result?.toolId || ev.result?.tool || ''
          // Map common tool names from event
          let tool = 'WALLET_ANALYZER'
          if (toolHex.includes('CONTRACT') || toolHex.includes('AUDITOR')) tool = 'CONTRACT_AUDITOR'
          else if (toolHex.includes('MARKET') || toolHex.includes('INTEL')) tool = 'MARKET_INTEL'

          const caller  = ev.result?.user || ev.contract_map?.[0]?.from || 'Unknown'
          const amount  = TOOL_COSTS[tool] || 50
          const burned  = Math.floor(amount * 0.7)
          const ts      = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : 'Just now'

          newEvents.push({
            id:     txHash,
            wallet: caller.length > 10 ? caller.slice(0,6) + '...' + caller.slice(-4) : caller,
            tool, amount, burned, time: ts
          })
        }

        if (newEvents.length > 0) {
          setBurns(b => [...newEvents, ...b].slice(0, 20))
          setNewBurn(true)
          setTimeout(() => setNewBurn(false), 800)
        }
      } catch { /* silent fail — Tronscan may be rate-limited */ }
    }

    pollBurnEvents() // immediate
    const t = setInterval(pollBurnEvents, 15000) // poll every 15s
    return () => clearInterval(t)
  }, [PLATFORM_ADDR])

  const fmtNum = (n: number, dec = 0) => n.toLocaleString(undefined, { maximumFractionDigits: dec })

  return (
    <>
      <Head><title>Dashboard | Lion X</title></Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>

        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#14b8a6' }}>Live Platform Dashboard</p>
              <h1 className="font-black text-3xl tracking-tight">LDA Token Stats</h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.15)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'breathe 1.5s infinite' }}/>
              <span className="text-xs font-bold" style={{ color: '#22c55e' }}>Live · Pulls from Tron every 15s</span>
            </div>
          </div>

          {/* ── BURN BANNER ── */}
          <div className="relative rounded-2xl p-6 mb-6 overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(245,166,35,0.3)' }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg,#f5a623,#ef4444,#f5a623)', backgroundSize:'200% 100%', animation:'shimmer 3s linear infinite' }}/>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'breathe 1.5s infinite' }}/>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>Platform Active</span>
                </div>
                <div className="font-black text-xl mb-1">🔥 LDA Burn Platform — Live Stats</div>
                <div className="text-sm" style={{ color: '#7a8a9a' }}>
                  Every AI query burns LDA permanently. 70% sent to black hole, 30% to treasury.
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-2">
                <Link href="/tools" className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline text-center"
                  style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000', minWidth: 160 }}>
                  ⚡ Use AI Tools
                </Link>
              </div>
            </div>

            {/* Burn progress bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs mb-2" style={{ color: '#7a8a9a' }}>
                <span>Total LDA Burned: <strong style={{color:'#ef4444'}}>{fmtNum(stats.burnedSupply)}</strong>
                  <span style={{color:'#4a5a6a'}}> / {fmtNum(LDA_SUPPLY)} supply</span>
                </span>
                <span style={{color:'#ef4444'}}>{stats.burnedPct ? stats.burnedPct.toFixed(2) + '% burned' : '0% burned'}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0c0c18' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(stats.burnedPct || 0, 0.1)}%`, background: 'linear-gradient(90deg,#ef4444,#f5a623)' }}/>
              </div>
            </div>
          </div>

          {/* ── TOKEN SUPPLY FLOW ── */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#4a5a6a' }}>LDA Token Flow</div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              {[
                { label: 'Total Supply',   val: fmtNum(stats.totalSupply || LDA_SUPPLY), sub: 'LDA on Tron',           color: '#7a8a9a', icon: '🦁' },
                null,
                { label: 'Burned',         val: fmtNum(stats.burnedSupply),              sub: `${stats.burnPct.toFixed(2)}% of supply`, color: '#ef4444', icon: '🔥' },
                null,
                { label: 'Circulating',    val: fmtNum(stats.circulating),               sub: 'In active wallets',     color: '#14b8a6', icon: '💎' },
                null,
                { label: 'Treasury',       val: fmtNum(stats.treasuryBalance),           sub: '30% of every burn',     color: '#a78bfa', icon: '🏦' },
              ].map((item, i) =>
                item === null ? (
                  <div key={i} className="text-2xl" style={{ color: '#14b8a6', opacity: 0.4 }}>→</div>
                ) : (
                  <div key={item.label} className="text-center">
                    <div className="text-xl mb-1">{item.icon}</div>
                    <div className="font-black text-lg" style={{ color: item.color }}>{item.val}</div>
                    <div className="text-xs font-bold" style={{ color: item.color, opacity: 0.8 }}>{item.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#4a5a6a' }}>{item.sub}</div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── KEY STATS GRID ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon:'🦁', label:'Total Supply',     val: fmtNum(stats.totalSupply || LDA_SUPPLY), sub:'Fixed — no new tokens ever',    color:'#14b8a6' },
              { icon:'🔥', label:'LDA Burned',       val: fmtNum(stats.burnedSupply),              sub:`${stats.burnPct.toFixed(2)}% permanently gone`, color:'#ef4444' },
              { icon:'👥', label:'Holders',          val: fmtNum(stats.holders),                   sub:'Unique wallets on Tron',         color:'#f5a623' },
              { icon:'⚡', label:'Burn Per Query',   val: '70%',                                   sub:'30% to treasury',                color:'#a78bfa' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.12)' }}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs font-bold mt-1">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#4a5a6a' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── ADDITIONAL STATS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon:'💎', label:'Circulating',      val: fmtNum(stats.circulating),             sub:'Total supply minus burned',      color:'#14b8a6' },
              { icon:'🏦', label:'Treasury Balance', val: fmtNum(stats.treasuryBalance),         sub:'Platform revenue wallet',        color:'#a78bfa' },
              { icon:'📊', label:'Burn Rate 24h',    val: fmtNum(stats.burnRate24h),             sub:'LDA burned via queries',         color:'#f5a623' },
              { icon:'🔒', label:'Black Hole',       val: fmtNum(stats.burnedSupply),            sub:'TLsV52s... permanently locked',  color:'#ef4444' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.12)' }}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs font-bold mt-1">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#4a5a6a' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── CHARTS + BURN FEED ── */}
          <div className="grid lg:grid-cols-3 gap-4 mb-6">

            {/* Charts */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.12)' }}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a5a6a' }}>Cumulative Burns</div>
                  <span className="text-xs font-bold" style={{ color: '#ef4444' }}>🔥 {fmtNum(stats.burnedSupply)} LDA</span>
                </div>
                <MiniChart data={burnHistory} color="#ef4444"/>
              </div>
              <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.12)' }}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a5a6a' }}>LDA Burned</div>
                  <span className="text-xs font-bold" style={{ color: '#f5a623' }}>🔄 {fmtNum(stats.totalBurned)} LDA</span>
                </div>
                <MiniChart data={issueHistory} color="#f5a623"/>
              </div>
            </div>

            {/* Live Burn Feed */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'breathe 2s infinite' }}/>
                  <span className="font-bold text-sm">🔥 Live Burn Feed</span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(20,184,166,0.08)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.15)' }}>
                    Live · Tronscan
                  </span>
                </div>
              </div>
              <div style={{ height: 340, overflowY: 'auto' }}>
                {burns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#4a5a6a' }}>
                    <span className="text-3xl opacity-30">🔥</span>
                    <p className="text-xs">Waiting for first burn event...</p>
                    <p className="text-xs opacity-60">Burns appear here in real-time once platform is live</p>
                  </div>
                ) : burns.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3 transition-all"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i===0 && newBurn ? 'rgba(239,68,68,0.06)':'transparent' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: '#0c0c18' }}>🔥</div>
                      <div>
                        <div className="text-xs font-bold font-mono" style={{ color: '#14b8a6' }}>{b.wallet}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#4a5a6a' }}>{TOOL_NAMES[b.tool]}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black" style={{ color: '#ef4444' }}>-{b.burned} LDA</div>
                      <div className="text-xs" style={{ color: '#4a5a6a' }}>{b.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── YOUR POSITION ── */}
          {connected && address && (
            <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#4a5a6a' }}>Your Position</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:'LDA Balance',   val: fmtNum(balance),  color:'#14b8a6' },
                  { label:'Your Tier',         val: balance >= 10000 ? '🥇 Gold' : balance >= 2000 ? '🥈 Silver' : balance >= 500 ? '🥉 Bronze' : '— None', color:'#f5a623' },
                  { label:'Query Discount',    val: balance >= 10000 ? '20%' : balance >= 2000 ? '10%' : balance >= 500 ? '5%' : '0%', color:'#14b8a6' },
                  { label:'% of Supply',       val: stats.totalBurned > 0 ? `${((balance/stats.totalBurned)*100).toFixed(3)}%` : '—', color:'#a78bfa' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-xs mb-1" style={{ color: '#4a5a6a' }}>{s.label}</div>
                    <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`
        @keyframes flash { 0%,100%{background:rgba(239,68,68,0.06)} 50%{background:rgba(239,68,68,0.14)} }
      `}</style>
    </>
  )
}
