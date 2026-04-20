import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'

interface BurnEvent {
  id: string
  wallet: string
  tool: string
  amount: number
  burned: number
  time: string
  ago: number
}

interface TokenStats {
  totalSupply: number
  totalBurned: number
  circulatingSupply: number
  holders: number
  treasuryBalance: number
  burnRate24h: number
  queryCount: number
}

const TOOL_NAMES: Record<string, string> = {
  WALLET_ANALYZER:  '🔍 Wallet Analyzer',
  CONTRACT_AUDITOR: '🛡️ Contract Auditor',
  MARKET_INTEL:     '📊 Market Intel',
}

// Simulated burn feed (replaced by real Tronscan events post-mainnet)
const MOCK_BURNS: BurnEvent[] = [
  { id: '1', wallet: 'TXk9...a4F2', tool: 'WALLET_ANALYZER',  amount: 50,  burned: 35,  time: '2m ago',  ago: 2  },
  { id: '2', wallet: 'TRm4...c8D1', tool: 'CONTRACT_AUDITOR', amount: 100, burned: 70,  time: '5m ago',  ago: 5  },
  { id: '3', wallet: 'TWz2...f9B3', tool: 'MARKET_INTEL',     amount: 25,  burned: 17,  time: '9m ago',  ago: 9  },
  { id: '4', wallet: 'TKp7...e2A0', tool: 'WALLET_ANALYZER',  amount: 50,  burned: 35,  time: '14m ago', ago: 14 },
  { id: '5', wallet: 'TNq3...d5C6', tool: 'CONTRACT_AUDITOR', amount: 100, burned: 70,  time: '18m ago', ago: 18 },
  { id: '6', wallet: 'TLs8...b7E4', tool: 'MARKET_INTEL',     amount: 25,  burned: 17,  time: '23m ago', ago: 23 },
  { id: '7', wallet: 'TMv1...a3F7', tool: 'WALLET_ANALYZER',  amount: 50,  burned: 35,  time: '31m ago', ago: 31 },
  { id: '8', wallet: 'TJw5...c9G2', tool: 'CONTRACT_AUDITOR', amount: 100, burned: 70,  time: '38m ago', ago: 38 },
]

function MiniChart({ data, color }: { data: number[], color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width = c.offsetWidth
    const H = c.height = c.offsetHeight
    const max = Math.max(...data), min = Math.min(...data)
    const range = max - min || 1
    const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - ((v - min) / range) * (H - 8) - 4 }))
    ctx.clearRect(0, 0, W, H)
    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, color + '40')
    grad.addColorStop(1, color + '00')
    ctx.beginPath()
    ctx.moveTo(pts[0].x, H)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length-1].x, H)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    // Line
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }, [data, color])
  return <canvas ref={ref} className="w-full h-full"/>
}

export default function Dashboard() {
  const { address, balance, connected } = useWallet()
  const [stats,  setStats]  = useState<TokenStats>({
    totalSupply: 10_000_000, totalBurned: 0, circulatingSupply: 10_000_000,
    holders: 281, treasuryBalance: 0, burnRate24h: 0, queryCount: 0,
  })
  const [burns,   setBurns]   = useState<BurnEvent[]>(MOCK_BURNS)
  const [newBurn, setNewBurn] = useState(false)
  const [burnHistory] = useState([0, 12, 45, 120, 203, 350, 487, 620, 890, 1240, 1580, 2100])
  const [queryHistory] = useState([0, 5, 18, 44, 78, 120, 168, 220, 290, 380, 470, 590])

  const LDA_V2    = process.env.NEXT_PUBLIC_LDA_V2   || ''
  const TREASURY  = process.env.NEXT_PUBLIC_LDA_V1   || ''

  // Fetch real stats
  useEffect(() => {
    async function fetchStats() {
      try {
        if (!LDA_V2) return
        const res  = await fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${LDA_V2}`)
        const data = await res.json()
        const token = data?.trc20_tokens?.[0]
        if (token) {
          const supply = Number(token.total_supply_with_decimals) / 1e6
          setStats(s => ({ ...s, circulatingSupply: supply, holders: token.holders_count || s.holders }))
        }
      } catch {}
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [LDA_V2])

  // Simulate incoming burns
  useEffect(() => {
    const tools = ['WALLET_ANALYZER', 'CONTRACT_AUDITOR', 'MARKET_INTEL']
    const costs = { WALLET_ANALYZER: 50, CONTRACT_AUDITOR: 100, MARKET_INTEL: 25 }
    const addrs = ['TXk9', 'TRm4', 'TWz2', 'TKp7', 'TNq3', 'TLs8', 'TMv1', 'TBc3', 'TSd9']

    const t = setInterval(() => {
      const tool   = tools[Math.floor(Math.random() * tools.length)]
      const amount = costs[tool as keyof typeof costs]
      const wallet = addrs[Math.floor(Math.random() * addrs.length)] + '...' + Math.random().toString(36).slice(2,6).toUpperCase()
      const newEvent: BurnEvent = {
        id: Date.now().toString(), wallet, tool, amount, burned: Math.floor(amount * .7), time: 'Just now', ago: 0
      }
      setBurns(b => [newEvent, ...b.slice(0, 19)])
      setStats(s => ({ ...s, totalBurned: s.totalBurned + Math.floor(amount*.7), queryCount: s.queryCount + 1, burnRate24h: s.burnRate24h + Math.floor(amount*.7) }))
      setNewBurn(true)
      setTimeout(() => setNewBurn(false), 1000)
    }, 8000)
    return () => clearInterval(t)
  }, [])

  const burnPct = ((stats.totalBurned / stats.totalSupply) * 100).toFixed(3)

  return (
    <>
      <Head><title>Dashboard | Lion X</title></Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>

        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#14b8a6' }}>Platform Dashboard</p>
              <h1 className="font-black text-3xl tracking-tight">LDA v2 Live Stats</h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.15)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'breathe 1.5s infinite' }}/>
              <span className="text-xs font-bold" style={{ color: '#22c55e' }}>Live · Updates every 30s</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Burned',   val: stats.totalBurned.toLocaleString(),           sub: `${burnPct}% of supply`,        color: '#ef4444', icon: '🔥' },
              { label: 'Circulating',    val: (stats.circulatingSupply-stats.totalBurned).toLocaleString(), sub: `of 10M max`,  color: '#14b8a6', icon: '💎' },
              { label: 'Holders',        val: stats.holders.toLocaleString(),                sub: 'LDA v2 wallets',               color: '#f5a623', icon: '👥' },
              { label: 'Queries Run',    val: stats.queryCount.toLocaleString(),             sub: '24h platform usage',           color: '#14b8a6', icon: '⚡' },
            ].map(s => (
              <div key={s.label} className="relative rounded-2xl p-5 overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs font-bold mb-0.5">{s.label}</div>
                <div className="text-xs" style={{ color: '#4a5a6a' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#4a5a6a' }}>Cumulative Burn</div>
                  <div className="text-xl font-black" style={{ color: '#ef4444' }}>{stats.totalBurned.toLocaleString()} LDA v2</div>
                </div>
                <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>🔥 Deflationary</div>
              </div>
              <div style={{ height: 80 }}><MiniChart data={burnHistory} color="#ef4444"/></div>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#4a5a6a' }}>Total Queries</div>
                  <div className="text-xl font-black" style={{ color: '#14b8a6' }}>{stats.queryCount.toLocaleString()} runs</div>
                </div>
                <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}>⚡ Platform Usage</div>
              </div>
              <div style={{ height: 80 }}><MiniChart data={queryHistory} color="#14b8a6"/></div>
            </div>
          </div>

          {/* Supply Bar */}
          <div className="rounded-2xl p-5 mb-8" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-bold">Supply Distribution</div>
              <div className="text-xs" style={{ color: '#4a5a6a' }}>10,000,000 LDA v2 hard cap</div>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex" style={{ background: '#0c0c18' }}>
              <div style={{ width: `${burnPct}%`, background: 'linear-gradient(90deg,#ef4444,#f97316)', transition: 'width 1s ease' }}/>
              <div style={{ width: `${100 - Number(burnPct)}%`, background: 'linear-gradient(90deg,#14b8a6,#0d9488)' }}/>
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span style={{ color: '#ef4444' }}>🔥 Burned: {stats.totalBurned.toLocaleString()}</span>
              <span style={{ color: '#14b8a6' }}>💎 Circulating: {(stats.totalSupply - stats.totalBurned).toLocaleString()}</span>
            </div>
          </div>

          {/* Main grid — Burn Feed + User Stats */}
          <div className="grid lg:grid-cols-3 gap-4">

            {/* Live Burn Feed */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: newBurn ? 'none' : 'breathe 2s infinite' }}/>
                  <span className="font-bold text-sm">🔥 Live Burn Feed</span>
                </div>
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                  Real-time
                </span>
              </div>

              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {burns.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3 transition-all"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: i === 0 && newBurn ? 'rgba(239,68,68,0.06)' : 'transparent',
                      animation: i === 0 && newBurn ? 'flash 0.8s ease' : 'none',
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.05)' }}>
                        🔥
                      </div>
                      <div>
                        <div className="text-xs font-bold font-mono" style={{ color: '#14b8a6' }}>{b.wallet}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#4a5a6a' }}>{TOOL_NAMES[b.tool] || b.tool}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black" style={{ color: '#ef4444' }}>-{b.burned} LDA v2</div>
                      <div className="text-xs" style={{ color: '#4a5a6a' }}>{b.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel */}
            <div className="flex flex-col gap-4">
              {/* Your Stats */}
              <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#4a5a6a' }}>Your Position</div>
                {connected && address ? (
                  <>
                    <div className="text-2xl font-black mb-1" style={{ color: '#14b8a6' }}>{balance.toLocaleString()}</div>
                    <div className="text-xs mb-4" style={{ color: '#4a5a6a' }}>LDA v2 balance</div>
                    <div className="space-y-2">
                      {[['Tier', balance >= 10000 ? '🥇 Gold' : balance >= 2000 ? '🥈 Silver' : balance >= 500 ? '🥉 Bronze' : '—'],
                        ['Query Discount', balance >= 10000 ? '20%' : balance >= 2000 ? '10%' : balance >= 500 ? '5%' : '0%'],
                        ['Next Tier', balance >= 10000 ? 'Max tier reached' : balance >= 2000 ? `${(10000-balance).toLocaleString()} to Gold` : balance >= 500 ? `${(2000-balance).toLocaleString()} to Silver` : `${(500-balance).toLocaleString()} to Bronze`],
                      ].map(([k,v]) => (
                        <div key={k} className="flex justify-between text-xs py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#7a8a9a' }}>
                          <span>{k}</span><span className="font-bold" style={{ color: '#dde8f0' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2 opacity-30">🦁</div>
                    <p className="text-xs" style={{ color: '#4a5a6a' }}>Connect wallet to see your stats</p>
                  </div>
                )}
              </div>

              {/* Tool Usage */}
              <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#4a5a6a' }}>Tool Usage Today</div>
                {[['🔍 Wallet Analyzer', 58, '#14b8a6'],['🛡️ Contract Auditor', 28, '#f5a623'],['📊 Market Intel', 14, '#ef4444']].map(([name, pct, color]) => (
                  <div key={name as string} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: '#7a8a9a' }}>{name}</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0c0c18' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color as string }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      <style>{`
        @keyframes flash {
          0%,100% { background: rgba(239,68,68,0.06); }
          50%      { background: rgba(239,68,68,0.15); }
        }
      `}</style>
    </>
  )
}
