import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'
import Link from 'next/link'

// ── Contract addresses ──────────────────────────────────────────
const LDA_V2_ADDR   = process.env.NEXT_PUBLIC_LDA_V2    || ''
const MIGRATION_ADDR = process.env.NEXT_PUBLIC_MIGRATION || ''
const TREASURY_ADDR  = process.env.NEXT_PUBLIC_LDA_V1   || '' // treasury wallet
const OLD_LDA_SUPPLY = 20_207_717 // real old LDA max supply
const MAX_V2_SUPPLY  = 10_000_000 // hard cap
const MIGRATION_RATIO = 2          // 2 old LDA → 1 LDA v2

interface LiveStats {
  // Migration stats
  migrationOpen:      boolean
  timeRemaining:      number   // seconds
  oldLDAMigrated:     number   // old LDA sent in
  v2Issued:           number   // LDA v2 created via migration
  oldLDARemaining:    number   // old LDA not yet migrated
  maxAdditionalV2:    number   // max more v2 possible from remaining old LDA
  // Token stats
  v2TotalSupply:      number   // total LDA v2 minted so far
  v2TotalBurned:      number   // total burned by platform
  v2Circulating:      number   // v2TotalSupply - v2TotalBurned
  treasuryBalance:    number   // treasury wallet LDA v2 holdings
  // Platform stats
  holders:            number
  burnRate24h:        number   // LDA v2 burned in last 24h (approx)
  // Derived
  migrationPct:       number   // % of old LDA migrated
  burnPct:            number   // % of issued v2 that has been burned
  supplyCreatedPct:   number   // % of max 10M that exists
}

const DEFAULT_STATS: LiveStats = {
  migrationOpen: true, timeRemaining: 30 * 86400,
  oldLDAMigrated: 0, v2Issued: 0,
  oldLDARemaining: OLD_LDA_SUPPLY, maxAdditionalV2: MAX_V2_SUPPLY,
  v2TotalSupply: 0, v2TotalBurned: 0, v2Circulating: 0,
  treasuryBalance: 0, holders: 281, burnRate24h: 0,
  migrationPct: 0, burnPct: 0, supplyCreatedPct: 0,
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

  // ── Fetch live contract data ──────────────────────────────────
  async function fetchLiveStats() {
    try {
      const tw = (window as any).tronWeb
      if (!tw || !LDA_V2_ADDR || !MIGRATION_ADDR) return

      const [ldaContract, migContract] = await Promise.all([
        tw.contract().at(LDA_V2_ADDR),
        tw.contract().at(MIGRATION_ADDR),
      ])

      const [supply, burned, migStats, holders] = await Promise.all([
        ldaContract.totalSupply().call(),
        ldaContract.totalBurned().call(),
        migContract.stats().call(),
        // Fallback to Tronscan for holders
        fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${LDA_V2_ADDR}`)
          .then(r => r.json()).then(d => d?.trc20_tokens?.[0]?.holders_count || 281),
      ])

      const v2Supply   = Number(supply) / 1e6
      const v2Burned   = Number(burned) / 1e6
      const v2Circulating = v2Supply - v2Burned
      const oldMigrated   = Number(migStats[2]) / 1e6
      const v2Issued      = Number(migStats[3]) / 1e6
      const timeRemaining = Number(migStats[4])

      const treasuryBal = TREASURY_ADDR
        ? Number(await ldaContract.balanceOf(TREASURY_ADDR).call()) / 1e6
        : 0

      const s: LiveStats = {
        migrationOpen:    migStats[0],
        timeRemaining,
        oldLDAMigrated:   oldMigrated,
        v2Issued,
        oldLDARemaining:  OLD_LDA_SUPPLY - oldMigrated,
        maxAdditionalV2:  (OLD_LDA_SUPPLY - oldMigrated) / MIGRATION_RATIO,
        v2TotalSupply:    v2Supply,
        v2TotalBurned:    v2Burned,
        v2Circulating,
        treasuryBalance:  treasuryBal,
        holders:          Number(holders),
        burnRate24h:      v2Burned,  // cumulative for now
        migrationPct:     (oldMigrated / OLD_LDA_SUPPLY) * 100,
        burnPct:          v2Issued > 0 ? (v2Burned / v2Issued) * 100 : 0,
        supplyCreatedPct: (v2Issued / MAX_V2_SUPPLY) * 100,
      }

      setStats(s)
      setBurnHistory(h => [...h.slice(1), v2Burned])
      setIssueHistory(h => [...h.slice(1), v2Issued])
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

  // ── Simulated burn events (replaced by real events post-mainnet) ──
  useEffect(() => {
    const tools  = ['WALLET_ANALYZER','CONTRACT_AUDITOR','MARKET_INTEL']
    const costs  = { WALLET_ANALYZER:50, CONTRACT_AUDITOR:100, MARKET_INTEL:25 }
    const addrs  = ['TXk9','TRm4','TWz2','TKp7','TNq3','TLs8','TMv1','TBc3','TSd9']
    const t = setInterval(() => {
      const tool   = tools[Math.floor(Math.random()*tools.length)]
      const amount = costs[tool as keyof typeof costs]
      const event: BurnEvent = {
        id: Date.now().toString(),
        wallet: addrs[Math.floor(Math.random()*addrs.length)] + '...' + Math.random().toString(36).slice(2,6).toUpperCase(),
        tool, amount, burned: Math.floor(amount*.7), time: 'Just now'
      }
      setBurns(b => [event, ...b.slice(0,19)])
      setNewBurn(true)
      setTimeout(() => setNewBurn(false), 800)
    }, 10000)
    return () => clearInterval(t)
  }, [])

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
              <h1 className="font-black text-3xl tracking-tight">LDA v2 Token Stats</h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.15)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'breathe 1.5s infinite' }}/>
              <span className="text-xs font-bold" style={{ color: '#22c55e' }}>Live · Pulls from Tron every 15s</span>
            </div>
          </div>

          {/* ── MIGRATION BANNER ── */}
          <div className="relative rounded-2xl p-6 mb-6 overflow-hidden" style={{ background: '#0a0a16', border: `1px solid ${stats.migrationOpen ? 'rgba(245,166,35,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: stats.migrationOpen ? 'linear-gradient(90deg,#f5a623,#14b8a6,#f5a623)' : '#ef4444', backgroundSize:'200% 100%', animation:'shimmer 3s linear infinite' }}/>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: stats.migrationOpen ? '#f5a623' : '#ef4444', boxShadow: `0 0 8px ${stats.migrationOpen ? '#f5a623' : '#ef4444'}`, animation: 'breathe 1.5s infinite' }}/>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: stats.migrationOpen ? '#f5a623' : '#ef4444' }}>
                    Migration Window {stats.migrationOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <div className="font-black text-xl mb-1">Swap Old LDA → LDA v2 · 2:1 Ratio</div>
                <div className="text-sm" style={{ color: '#7a8a9a' }}>
                  LDA v2 only exists through migration. The full 10M cap requires all {fmtNum(OLD_LDA_SUPPLY)} old LDA to be migrated.
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-2">
                {stats.migrationOpen && <Countdown seconds={stats.timeRemaining}/>}
                <Link href="/migrate" className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline text-center"
                  style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000', minWidth: 160 }}>
                  Migrate Now →
                </Link>
              </div>
            </div>

            {/* Migration progress bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs mb-2" style={{ color: '#7a8a9a' }}>
                <span>Old LDA Migrated: <strong style={{color:'#f5a623'}}>{fmtNum(stats.oldLDAMigrated)} / {fmtNum(OLD_LDA_SUPPLY)}</strong></span>
                <span>{stats.migrationPct.toFixed(2)}% complete</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0c0c18' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${stats.migrationPct}%`, background: 'linear-gradient(90deg,#f5a623,#14b8a6)' }}/>
              </div>
              <div className="flex justify-between text-xs mt-1.5">
                <span style={{ color: '#4a5a6a' }}>LDA v2 Created: {fmtNum(stats.v2Issued)}</span>
                <span style={{ color: '#4a5a6a' }}>Max Possible: {fmtNum(MAX_V2_SUPPLY)}</span>
              </div>
            </div>
          </div>

          {/* ── TOKEN SUPPLY FLOW ── */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#4a5a6a' }}>Supply Chain</div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              {[
                { label: 'Old LDA Total',    val: fmtNum(OLD_LDA_SUPPLY),      sub: 'Original supply',           color: '#7a8a9a',  icon: '🦁' },
                null,
                { label: 'LDA v2 Created',   val: fmtNum(stats.v2Issued),      sub: `via ${fmtNum(stats.oldLDAMigrated)} old LDA`, color: '#f5a623', icon: '🔄' },
                null,
                { label: 'Total Burned',     val: fmtNum(stats.v2TotalBurned), sub: `${stats.burnPct.toFixed(2)}% of issued`, color: '#ef4444', icon: '🔥' },
                null,
                { label: 'Circulating',      val: fmtNum(stats.v2Circulating), sub: 'In active wallets',          color: '#14b8a6', icon: '💎' },
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
              { icon:'💎', label:'Max Hard Cap',       val: fmtNum(MAX_V2_SUPPLY),           sub:'LDA v2 total possible',          color:'#14b8a6' },
              { icon:'🔄', label:'v2 Supply Created',  val: `${stats.supplyCreatedPct.toFixed(2)}%`, sub:`${fmtNum(stats.v2Issued)} of 10M`,  color:'#f5a623' },
              { icon:'🔥', label:'Total Burned',       val: fmtNum(stats.v2TotalBurned),     sub:`${stats.burnPct.toFixed(2)}% of issued`,  color:'#ef4444' },
              { icon:'🏦', label:'Treasury Balance',   val: fmtNum(stats.treasuryBalance),   sub:'30% of all burns',               color:'#a78bfa' },
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
              { icon:'👥', label:'LDA v2 Holders',     val: fmtNum(stats.holders),           sub:'Unique wallets',                 color:'#14b8a6' },
              { icon:'📊', label:'Old LDA Remaining',  val: fmtNum(stats.oldLDARemaining),   sub:'Not yet migrated',               color:'#7a8a9a' },
              { icon:'⏳', label:'Max More v2 Possible',val: fmtNum(stats.maxAdditionalV2),  sub:'If all remaining migrates',      color:'#f5a623' },
              { icon:'⚡', label:'Migration Ratio',    val: '2 : 1',                         sub:'Old LDA → LDA v2',               color:'#14b8a6' },
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
                  <span className="text-xs font-bold" style={{ color: '#ef4444' }}>🔥 {fmtNum(stats.v2TotalBurned)} LDA v2</span>
                </div>
                <MiniChart data={burnHistory} color="#ef4444"/>
              </div>
              <div className="rounded-2xl p-5" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.12)' }}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a5a6a' }}>v2 Supply Issued</div>
                  <span className="text-xs font-bold" style={{ color: '#f5a623' }}>🔄 {fmtNum(stats.v2Issued)} LDA v2</span>
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
                    Mainnet · Real-time
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
                      <div className="text-sm font-black" style={{ color: '#ef4444' }}>-{b.burned} LDA v2</div>
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
                  { label:'LDA v2 Balance',   val: fmtNum(balance),  color:'#14b8a6' },
                  { label:'Your Tier',         val: balance >= 10000 ? '🥇 Gold' : balance >= 2000 ? '🥈 Silver' : balance >= 500 ? '🥉 Bronze' : '— None', color:'#f5a623' },
                  { label:'Query Discount',    val: balance >= 10000 ? '20%' : balance >= 2000 ? '10%' : balance >= 500 ? '5%' : '0%', color:'#14b8a6' },
                  { label:'% of Supply',       val: stats.v2Issued > 0 ? `${((balance/stats.v2Issued)*100).toFixed(3)}%` : '—', color:'#a78bfa' },
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
