import Head from 'next/head'
import { useState } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'

const CATEGORIES = ['All', 'Security', 'Analytics', 'Trading', 'NFT', 'DeFi', 'Utility']

const AGENTS = [
  // Platform tools (built by Lion X)
  {
    id: 'wallet-analyzer', icon: '🔍', name: 'Wallet Analyzer',
    desc: 'Deep-dive any Tron wallet — portfolio breakdown, trading patterns, whale/bot classification and full risk profile.',
    builder: 'Lion X', builderVerified: true, cost: 50, uses: 0,
    category: 'Analytics', tags: ['Tron', 'Wallets', 'Risk'], live: true, official: true,
  },
  {
    id: 'contract-auditor', icon: '🛡️', name: 'Contract Auditor',
    desc: 'Scan any TRC-20 contract for honeypots, rug pull indicators, ownership concentration and hidden tax functions.',
    builder: 'Lion X', builderVerified: true, cost: 100, uses: 0,
    category: 'Security', tags: ['Tron', 'Contracts', 'Security'], live: true, official: true,
  },
  {
    id: 'market-intel', icon: '📊', name: 'Market Intelligence',
    desc: 'AI-powered token analysis — sentiment, holder trends, buy/sell pressure and actionable market commentary.',
    builder: 'Lion X', builderVerified: true, cost: 25, uses: 0,
    category: 'Analytics', tags: ['Tron', 'Markets', 'AI'], live: true, official: true,
  },
  // Upcoming builder slots
  {
    id: 'trade-signals', icon: '🤖', name: 'Trade Signal Bot',
    desc: 'Real-time buy/sell signals for Tron DeFi pairs based on on-chain momentum and liquidity flow analysis.',
    builder: 'Builder Slot', builderVerified: false, cost: 75, uses: 0,
    category: 'Trading', tags: ['DeFi', 'Signals', 'Tron'], live: false, official: false,
  },
  {
    id: 'whale-tracker', icon: '🐋', name: 'Whale Tracker',
    desc: 'Monitor large wallet movements in real-time. Get alerts when whales accumulate or dump any token on Tron.',
    builder: 'Builder Slot', builderVerified: false, cost: 60, uses: 0,
    category: 'Analytics', tags: ['Whales', 'Alerts', 'Tron'], live: false, official: false,
  },
  {
    id: 'nft-valuator', icon: '💎', name: 'NFT Valuator',
    desc: 'AI-powered NFT appraisal for Tron collections. Rarity scoring, floor price prediction and market context.',
    builder: 'Builder Slot', builderVerified: false, cost: 40, uses: 0,
    category: 'NFT', tags: ['NFT', 'Tron', 'AI'], live: false, official: false,
  },
  {
    id: 'defi-yield', icon: '🌾', name: 'DeFi Yield Scanner',
    desc: 'Scan Tron DeFi protocols for the best yield opportunities. Compares APY, risk and liquidity depth.',
    builder: 'Builder Slot', builderVerified: false, cost: 35, uses: 0,
    category: 'DeFi', tags: ['DeFi', 'Yield', 'JustLend'], live: false, official: false,
  },
  {
    id: 'portfolio-ai', icon: '📈', name: 'Portfolio Advisor',
    desc: 'Connect your wallet and get AI-powered portfolio analysis, rebalancing suggestions and risk assessment.',
    builder: 'Builder Slot', builderVerified: false, cost: 80, uses: 0,
    category: 'Analytics', tags: ['Portfolio', 'AI', 'Advice'], live: false, official: false,
  },
]

export default function Marketplace() {
  const { connected, connect } = useWallet()
  const [category,    setCategory]    = useState('All')
  const [search,      setSearch]      = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const [builderForm, setBuilderForm] = useState({ name: '', desc: '', cost: '', category: '', wallet: '', contact: '' })
  const [submitted,   setSubmitted]   = useState(false)

  const filtered = AGENTS.filter(a => {
    const matchCat  = category === 'All' || a.category === category
    const matchSrch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSrch
  })

  const liveCount    = AGENTS.filter(a => a.live).length
  const builderSlots = AGENTS.filter(a => !a.live).length

  return (
    <>
      <Head><title>Agent Marketplace | Lion X</title></Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>

        {/* HERO */}
        <div className="relative pt-28 pb-16 px-4 text-center" style={{ borderBottom: '1px solid rgba(20,184,166,0.1)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(20,184,166,0.07) 0%,transparent 60%)' }}/>
          <div className="relative z-10 max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#14b8a6' }}>Agent Marketplace</p>
            <h1 className="font-black mb-4 tracking-tight" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: -2 }}>
              AI Tools Powered by{' '}
              <span style={{ background: 'linear-gradient(135deg,#f5a623,#ff9a00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LDA v2</span>
            </h1>
            <p className="text-sm mb-8 max-w-lg mx-auto" style={{ color: '#7a8a9a', lineHeight: 1.8 }}>
              Browse AI agents built on the Lion X platform. Run any tool by burning LDA v2.
              Builders earn a share of every query their tool processes.
            </p>

            {/* Stats */}
            <div className="flex justify-center gap-8 flex-wrap mb-8">
              {[['🔧', liveCount, 'Live Tools'],['🔮', builderSlots, 'Builder Slots'],['🔥', 'LDA v2', 'Powered By'],['💰', '70%', 'Burned Per Query']].map(([icon,val,label]) => (
                <div key={label as string} className="text-center">
                  <div className="text-xl font-black" style={{ color: '#14b8a6' }}>{icon} {val}</div>
                  <div className="text-xs mt-1" style={{ color: '#4a5a6a' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.18)', color: '#dde8f0' }}
                onFocus={e => e.target.style.borderColor = '#14b8a6'}
                onBlur={e => e.target.style.borderColor = 'rgba(20,184,166,0.18)'}/>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap mb-8">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: category === c ? '#14b8a6' : 'rgba(20,184,166,0.08)',
                  color:      category === c ? '#000'    : '#7a8a9a',
                  border:     `1px solid ${category === c ? '#14b8a6' : 'rgba(20,184,166,0.15)'}`,
                }}>
                {c}
              </button>
            ))}
            <div className="flex-1"/>
            <button onClick={() => setShowBuilder(true)}
              className="px-5 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000' }}>
              + List Your Tool
            </button>
          </div>

          {/* Tool Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {filtered.map(agent => (
              <div key={agent.id} className="relative rounded-2xl p-6 flex flex-col transition-all duration-300"
                style={{ background: '#0a0a16', border: `1px solid ${agent.live ? 'rgba(20,184,166,0.18)' : 'rgba(255,255,255,0.05)'}`, opacity: agent.live ? 1 : 0.6 }}
                onMouseEnter={e => agent.live && (e.currentTarget.style.borderColor = '#14b8a6')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = agent.live ? 'rgba(20,184,166,0.18)' : 'rgba(255,255,255,0.05)')}>

                {/* Badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {agent.official && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', color: '#14b8a6' }}>Official</span>
                  )}
                  {!agent.live && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5a6a' }}>Open Slot</span>
                  )}
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: agent.live ? 'rgba(20,184,166,0.1)' : '#0c0c18', border: `1px solid ${agent.live ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                    {agent.icon}
                  </div>
                  <div>
                    <div className="font-bold text-base">{agent.name}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#4a5a6a' }}>
                      <span>{agent.builder}</span>
                      {agent.builderVerified && <span style={{ color: '#14b8a6' }}>✓</span>}
                    </div>
                  </div>
                </div>

                <p className="text-sm mb-4 flex-1" style={{ color: '#7a8a9a', lineHeight: 1.65 }}>{agent.desc}</p>

                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {agent.tags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: '#0c0c18', color: '#4a5a6a' }}>{t}</span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#f5a623' }}>
                    🔥 {agent.cost} LDA v2
                  </div>
                  {agent.live ? (
                    <a href="/tools"
                      className="px-4 py-1.5 rounded-lg text-xs font-bold no-underline transition-all"
                      style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000' }}>
                      Run Tool →
                    </a>
                  ) : (
                    <button onClick={() => setShowBuilder(true)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623', background: 'transparent' }}>
                      Claim Slot →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Builder CTA Banner */}
          <div className="relative rounded-2xl p-8 overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 80% at 100% 50%,rgba(245,166,35,0.05) 0%,transparent 70%)' }}/>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg,transparent,#f5a623,transparent)' }}/>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f5a623' }}>For Builders</div>
                <h3 className="font-black text-2xl mb-2 tracking-tight">Build on Lion X. Earn from Every Query.</h3>
                <p className="text-sm max-w-lg" style={{ color: '#7a8a9a', lineHeight: 1.7 }}>
                  Deploy your AI agent on the Lion X platform. Users pay in LDA v2 — you earn a percentage of every query your tool processes. No infrastructure costs. No payment processing. Just build and earn.
                </p>
                <div className="flex gap-6 mt-4 flex-wrap">
                  {[['Up to 80%','Revenue Share'],['LDA v2','Payment Rail'],['Zero','Infrastructure Cost']].map(([v,l]) => (
                    <div key={l}>
                      <div className="font-black text-lg" style={{ color: '#f5a623' }}>{v}</div>
                      <div className="text-xs" style={{ color: '#4a5a6a' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowBuilder(true)}
                className="px-8 py-4 rounded-xl font-extrabold text-base flex-shrink-0 transition-all"
                style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000', boxShadow: '0 4px 24px rgba(245,166,35,0.3)' }}>
                Apply as Builder →
              </button>
            </div>
          </div>
        </div>

        {/* Builder Modal */}
        {showBuilder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
            <div className="relative rounded-2xl p-8 w-full max-w-lg" style={{ background: '#0e0e22', border: '1px solid rgba(245,166,35,0.25)' }}>
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#14b8a6,#f5a623)' }}/>
              <button onClick={() => setShowBuilder(false)} className="absolute top-4 right-4 text-xl" style={{ color: '#4a5a6a', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>

              {!submitted ? (
                <>
                  <h3 className="font-black text-xl mb-1">List Your AI Tool</h3>
                  <p className="text-sm mb-6" style={{ color: '#7a8a9a' }}>Submit your tool for review. Approved tools go live on the marketplace.</p>

                  <div className="space-y-4">
                    {[
                      { key: 'name',     label: 'Tool Name',            placeholder: 'e.g. Tron Sentiment Analyzer' },
                      { key: 'desc',     label: 'Description',          placeholder: 'What does your tool do?' },
                      { key: 'cost',     label: 'Query Cost (LDA v2)',   placeholder: 'e.g. 50' },
                      { key: 'category', label: 'Category',             placeholder: 'Security / Analytics / Trading / NFT / DeFi' },
                      { key: 'wallet',   label: 'Tron Wallet (payouts)', placeholder: 'Your TRX wallet address' },
                      { key: 'contact',  label: 'Contact (Telegram/Email)', placeholder: 'How to reach you' },
                    ].map(f => (
                      <div key={f.key}>
                        <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#4a5a6a' }}>{f.label}</div>
                        {f.key === 'desc' ? (
                          <textarea value={builderForm[f.key as keyof typeof builderForm]}
                            onChange={e => setBuilderForm(b => ({ ...b, [f.key]: e.target.value }))}
                            placeholder={f.placeholder} rows={3}
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                            style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)', color: '#dde8f0', fontFamily: 'inherit' }}
                            onFocus={e => e.target.style.borderColor = '#14b8a6'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}/>
                        ) : (
                          <input value={builderForm[f.key as keyof typeof builderForm]}
                            onChange={e => setBuilderForm(b => ({ ...b, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                            style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)', color: '#dde8f0' }}
                            onFocus={e => e.target.style.borderColor = '#14b8a6'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}/>
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setSubmitted(true)}
                    disabled={!builderForm.name || !builderForm.desc || !builderForm.wallet}
                    className="w-full mt-6 py-3.5 rounded-xl font-extrabold text-sm disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000' }}>
                    Submit for Review
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🦁</div>
                  <h3 className="font-black text-xl mb-3">Application Submitted!</h3>
                  <p className="text-sm" style={{ color: '#7a8a9a', lineHeight: 1.75 }}>
                    We'll review your tool and reach out within 48 hours.
                    Once approved, your tool goes live and starts earning from every query.
                  </p>
                  <button onClick={() => { setShowBuilder(false); setSubmitted(false); setBuilderForm({ name:'',desc:'',cost:'',category:'',wallet:'',contact:'' }) }}
                    className="mt-6 px-6 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', color: '#14b8a6' }}>
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
