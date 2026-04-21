/**
 * ActivityTicker — Live burn activity feed
 * Polls Tronscan for real LDA transfers to treasury every 15s
 * Falls back to demo events if no real activity yet
 */
import { useEffect, useRef, useState } from 'react'

const TREASURY = process.env.NEXT_PUBLIC_TREASURY || 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy'
const LDA_TOKEN = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1'

interface TickerEvent {
  id:     string
  wallet: string
  tool:   string
  amount: number
  time:   string
}

const TOOL_LABELS: Record<string, string> = {
  WALLET_ANALYZER:  'Wallet Analysis',
  CONTRACT_AUDITOR: 'Contract Audit',
  MARKET_INTEL:     'Market Intel',
}
const TOOL_COSTS: Record<string, number> = {
  WALLET_ANALYZER: 50, CONTRACT_AUDITOR: 100, MARKET_INTEL: 25,
}

// Demo events shown before real data arrives
const DEMO: TickerEvent[] = [
  { id:'d1', wallet:'TXk9...4F2A', tool:'Wallet Analysis',  amount:50,  time:'2m ago' },
  { id:'d2', wallet:'TRm4...9B1C', tool:'Contract Audit',   amount:100, time:'5m ago' },
  { id:'d3', wallet:'TWz2...D3E7', tool:'Market Intel',     amount:25,  time:'8m ago' },
  { id:'d4', wallet:'TKp7...A1F9', tool:'Wallet Analysis',  amount:50,  time:'12m ago'},
  { id:'d5', wallet:'TNq3...5C2B', tool:'Contract Audit',   amount:100, time:'15m ago'},
]

export default function ActivityTicker() {
  const [events, setEvents]   = useState<TickerEvent[]>(DEMO)
  const [paused, setPaused]   = useState(false)
  const trackRef              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const seen = new Set<string>()

    async function poll() {
      try {
        // Poll real LDA transfers to treasury — this is how users pay for tools
        const res  = await fetch(
          `https://apilist.tronscanapi.com/api/contract/events?contract=${LDA_TOKEN}&toAddress=${TREASURY}&limit=10`
        )
        const data = await res.json()
        const evs  = data?.data || []
        if (!evs.length) return

        const fresh: TickerEvent[] = []
        const now = Date.now()
        for (const ev of evs) {
          const txHash = ev.transactionHash || ev.transaction_id
          if (!txHash || seen.has(txHash)) continue
          seen.add(txHash)

          const from   = ev.transferFromAddress || ev.from_address || ''
          const amount = Number(ev.amount || 0) / 1e6
          const ts     = Number(ev.timestamp || 0)

          // Infer tool from amount
          let tool = 'WALLET_ANALYZER'
          if (amount >= 100)     tool = 'CONTRACT_AUDITOR'
          else if (amount <= 25) tool = 'MARKET_INTEL'

          // Human-readable time
          const diffMin = ts ? Math.floor((now - ts) / 60000) : 0
          const time = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : `${Math.floor(diffMin/60)}h ago`

          fresh.push({
            id:     txHash,
            wallet: from.length > 10 ? from.slice(0,6)+'...'+from.slice(-4) : from || 'Unknown',
            tool:   TOOL_LABELS[tool] || 'AI Tool',
            amount,
            time,
          })
        }
        if (fresh.length) setEvents(e => [...fresh, ...e].slice(0, 30))
      } catch { /* silent */ }
    }

    poll()
    const t = setInterval(poll, 15000)
    return () => clearInterval(t)
  }, [])

  // Duplicate events for seamless loop
  const display = [...events, ...events]

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: 'rgba(5,5,8,0.95)',
        borderBottom: '1px solid rgba(20,184,166,0.1)',
        height: 36,
        position: 'relative',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left fade */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:60, background:'linear-gradient(to right, #050508, transparent)', zIndex:2, pointerEvents:'none' }}/>
      {/* Right fade */}
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:60, background:'linear-gradient(to left, #050508, transparent)', zIndex:2, pointerEvents:'none' }}/>

      {/* Live badge */}
      <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', zIndex:3, display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 6px #ef4444', display:'block', animation:'breathe 2s infinite' }}/>
        <span style={{ fontSize:10, fontWeight:800, color:'#ef4444', letterSpacing:1, textTransform:'uppercase' }}>Live</span>
      </div>

      {/* Scrolling track */}
      <div
        ref={trackRef}
        style={{
          display:    'flex',
          alignItems: 'center',
          height:     '100%',
          paddingLeft: 80,
          gap: 0,
          animation: paused ? 'none' : 'ticker 40s linear infinite',
          whiteSpace: 'nowrap',
        }}
      >
        {display.map((ev, i) => (
          <span key={`${ev.id}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:6, paddingRight:40 }}>
            <span style={{ fontSize:11, color:'#4a5a6a' }}>🔥</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#14b8a6' }}>{ev.wallet}</span>
            <span style={{ fontSize:11, color:'#7a8a9a' }}>burned</span>
            <span style={{ fontSize:11, fontWeight:800, color:'#f5a623' }}>{ev.amount} LDA</span>
            <span style={{ fontSize:11, color:'#7a8a9a' }}>for</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#dde8f0' }}>{ev.tool}</span>
            <span style={{ fontSize:10, color:'#2a3a4a' }}>· {ev.time}</span>
            <span style={{ color:'rgba(20,184,166,0.2)', fontSize:11, marginLeft:8 }}>|</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
