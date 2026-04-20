import Head from 'next/head'
import { useState, useEffect } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'

const TOOLS = [
  { id: 'WALLET_ANALYZER',  icon: '🔍', name: 'Wallet Analyzer',    shortName: 'Wallet',   desc: 'Deep-dive any Tron wallet — portfolio, patterns, risk score',     cost: 50,  inputLabel: 'Wallet Address',  placeholder: 'Enter TRX wallet address...' },
  { id: 'CONTRACT_AUDITOR', icon: '🛡️', name: 'Contract Auditor',   shortName: 'Contract', desc: 'Scan TRC-20 contracts for honeypots, rugs and hidden risks',       cost: 100, inputLabel: 'Contract Address', placeholder: 'Enter contract address...'   },
  { id: 'MARKET_INTEL',     icon: '📊', name: 'Market Intelligence', shortName: 'Market',   desc: 'AI-powered token sentiment, holder trends and market signals',     cost: 25,  inputLabel: 'Token Name or Address', placeholder: 'e.g. MANES or contract...' },
]

type RunState = 'idle' | 'approving' | 'running' | 'done' | 'error'

export default function Tools() {
  const { address, balance, connected, connect } = useWallet()
  const [activeTool, setActiveTool] = useState(0)
  const [input,      setInput]      = useState('')
  const [runState,   setRunState]   = useState<RunState>('idle')
  const [result,     setResult]     = useState<any>(null)
  const [history,    setHistory]    = useState<{tool:string,input:string,cost:number,time:string,score?:number,verdict?:string}[]>([])
  const [copied,     setCopied]     = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activePanel, setActivePanel] = useState<'query'|'history'>('query')
  const [tweetCopied, setTweetCopied] = useState(false)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lionx_query_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  // Persist history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      try { localStorage.setItem('lionx_query_history', JSON.stringify(history.slice(0,20))) } catch {}
    }
  }, [history])

  const tool     = TOOLS[activeTool]
  const PLATFORM = process.env.NEXT_PUBLIC_PLATFORM || ''
  const LDA_V2   = process.env.NEXT_PUBLIC_LDA_V2   || ''

  function shareReport() {
    if (!result || result.error) return
    const encoded = btoa(JSON.stringify({ tool: tool.id, input, result }))
    navigator.clipboard.writeText(`${window.location.origin}/report?d=${encoded}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareToX() {
    if (!result || result.error) return
    const encoded = btoa(JSON.stringify({ tool: tool.id, input, result }))
    const url     = `${window.location.origin}/report?d=${encoded}`
    const score   = result.score || ''
    const verdict = result.verdict || ''
    const tweet   = `🦁 ${tool.name} on Lion X AI Platform\n\n${verdict ? verdict + '\n' : ''}${score ? `Score: ${score}/100\n` : ''}\n🔗 ${url}\n\n#LionX #Tron #LDA #CryptoAI`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank')
    setTweetCopied(true)
    setTimeout(() => setTweetCopied(false), 2000)
  }

  async function runQuery() {
    if (!connected || !input.trim()) return
    setRunState('approving')
    setResult(null)
    try {
      const tw = (window as any).tronWeb
      if (!tw) throw new Error('TronLink not connected')
      const lda = await tw.contract().at(LDA_V2)
      await lda.approve(PLATFORM, (tool.cost * 1e6 * 10).toString()).send({ feeLimit: 100_000_000 })
      await new Promise(r => setTimeout(r, 4000))
      setRunState('running')
      const plat     = await tw.contract().at(PLATFORM)
      // Use keccak256 to match how Platform contract registered the tool
      const toolId   = tw.sha3(tool.id)
      const queryRef = tw.sha3(input + Date.now())
      const txHash   = await plat.executeQuery(toolId, queryRef).send({ feeLimit: 300_000_000 })
      await new Promise(r => setTimeout(r, 5000)) // Wait for block confirmation
      const res  = await fetch('/api/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: tool.id, input, address, txHash })
      })
      const data = await res.json()
      setResult(data)
      setRunState('done')
      setHistory(h => [{ tool: tool.name, input: input.slice(0,22)+'...', cost: tool.cost, time: new Date().toLocaleTimeString(), score: data.score, verdict: data.verdict }, ...h.slice(0,19)])
    } catch (e: any) {
      setRunState('error')
      setResult({ error: e?.message || 'Query failed' })
    }
  }

  return (
    <>
      <Head><title>AI Tools | Lion X</title></Head>

      {/* ── Desktop layout ─────────────────────────────────────── */}
      <div className="hidden md:flex flex-col" style={{ height: '100vh', background: '#050508', overflow: 'hidden' }}>
        <Navbar/>
        <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 60 }}>

          {/* Sidebar */}
          <div className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ width: 220, background: '#08080f', borderRight: '1px solid rgba(20,184,166,0.1)' }}>
            <div className="p-4">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5a6a' }}>AI Tools</div>
              {TOOLS.map((t, i) => (
                <button key={t.id} onClick={() => { setActiveTool(i); setInput(''); setRunState('idle'); setResult(null) }}
                  className="flex items-center gap-3 w-full p-3 rounded-xl mb-1 text-left transition-all"
                  style={{ background: activeTool===i ? 'rgba(20,184,166,0.1)' : 'transparent', border: activeTool===i ? '1px solid rgba(20,184,166,0.2)' : '1px solid transparent' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: activeTool===i ? 'rgba(20,184,166,0.15)' : '#0c0c18' }}>{t.icon}</div>
                  <div>
                    <div className="text-xs font-bold" style={{ color: activeTool===i ? '#14b8a6' : '#dde8f0' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: '#4a5a6a' }}>{t.cost} LDA</div>
                  </div>
                </button>
              ))}
              <div className="text-xs font-bold uppercase tracking-widest mt-5 mb-3" style={{ color: '#4a5a6a' }}>Coming Soon</div>
              {[['🤖','Trade Signals',75],['🐋','Whale Tracker',60],['💎','NFT Valuator',40]].map(([icon,name,cost]) => (
                <div key={name as string} className="flex items-center gap-3 p-3 rounded-xl mb-1 opacity-35">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: '#0c0c18' }}>{icon}</div>
                  <div>
                    <div className="text-xs font-bold">{name}</div>
                    <div className="text-xs" style={{ color: '#4a5a6a' }}>{cost} LDA</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5a6a' }}>Your Stats</div>
              {[['LDA Balance', balance.toLocaleString(), '#14b8a6'],['Queries Run', history.length, '#f5a623']].map(([l,v,c]) => (
                <div key={l as string} className="mb-3">
                  <div className="text-xs mb-1" style={{ color: '#4a5a6a' }}>{l}</div>
                  <div className="text-lg font-black" style={{ color: c as string }}>{v as string|number}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main panel */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)' }}>{tool.icon}</div>
                <div><div className="font-bold text-lg">{tool.name}</div><div className="text-xs" style={{ color: '#7a8a9a' }}>{tool.desc}</div></div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', color: '#f5a623' }}>
                🔥 {tool.cost} LDA per query
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Input */}
              <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-shrink-0" style={{ width: 320, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#4a5a6a' }}>{tool.inputLabel}</div>
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder={tool.placeholder}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                    style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)', color: '#dde8f0' }}
                    onFocus={e => e.target.style.borderColor = '#14b8a6'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}/>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#0c0c18' }}>
                  {[['Tool Cost',`${tool.cost} LDA`],['Burn (70%)',`${Math.floor(tool.cost*.7)} LDA 🔥`],['Treasury (30%)',`${Math.ceil(tool.cost*.3)} LDA`],['Balance After',`${Math.max(0,balance-tool.cost).toLocaleString()} LDA`]].map(([k,v]) => (
                    <div key={k} className="flex justify-between text-xs py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)', color: '#7a8a9a' }}>
                      <span>{k}</span><span className="font-bold" style={{ color: '#dde8f0' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {!connected ? (
                  <button onClick={connect} className="w-full py-3.5 rounded-xl font-extrabold text-sm" style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', border:'none', fontFamily:'inherit' }}>Connect TronLink</button>
                ) : runState === 'idle' || runState === 'error' ? (
                  <button onClick={runQuery} disabled={!input.trim()} className="w-full py-3.5 rounded-xl font-extrabold text-sm disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', border:'none', fontFamily:'inherit' }}>⚡ Run Analysis</button>
                ) : (
                  <button disabled className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6', border:'none', fontFamily:'inherit' }}>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-transparent" style={{ borderTopColor: '#14b8a6', animation: 'spin 0.7s linear infinite' }}/>
                    {runState === 'approving' ? 'Approving...' : 'Analyzing...'}
                  </button>
                )}
              </div>

              {/* Output */}
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs font-bold" style={{ color: '#7a8a9a' }}>⚡ Output</span>
                  <div className="flex items-center gap-2">
                    {runState === 'done' && result && !result.error && (
                      <button onClick={shareReport} className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(20,184,166,0.08)', color: copied ? '#22c55e' : '#14b8a6', border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'rgba(20,184,166,0.2)'}`, cursor:'pointer', fontFamily:'inherit' }}>
                        {copied ? '✅ Copied!' : '🔗 Share'}
                      </button>
                    )}
                    <span className="text-xs font-bold px-2.5 py-1 rounded" style={{ background: runState==='done'?'rgba(34,197,94,0.1)':runState==='running'||runState==='approving'?'rgba(245,166,35,0.1)':'rgba(20,184,166,0.1)', color: runState==='done'?'#22c55e':runState==='running'||runState==='approving'?'#f5a623':'#14b8a6', border:`1px solid ${runState==='done'?'rgba(34,197,94,0.2)':'rgba(20,184,166,0.2)'}` }}>
                      {runState==='done'?'Complete':runState==='running'?'Analyzing...':runState==='approving'?'Approving...':'Ready'}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {runState === 'idle' && <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: '#4a5a6a' }}><span className="text-5xl opacity-30">{tool.icon}</span><p className="text-sm">Enter an address and run analysis</p></div>}
                  {(runState === 'approving' || runState === 'running') && (
                    <div className="p-4 rounded-xl font-mono text-xs" style={{ background: '#020208', border: '1px solid rgba(20,184,166,0.15)' }}>
                      {['▶ Connecting to Tron node...', runState==='running'?'▶ Verifying LDA burn... confirmed':'▶ Waiting for approval...', runState==='running'?'▶ Fetching on-chain data...':'', runState==='running'?'▶ Running AI analysis model...':''].filter(Boolean).map((l,i) => (
                        <div key={i} className="py-0.5" style={{ color: i===0?'#14b8a6':i===1?'#22c55e':'#7a8a9a' }}>{l}</div>
                      ))}
                    </div>
                  )}
                  {runState === 'done' && result && !result.error && <ResultDisplay result={result}/>}
                  {runState === 'error' && result?.error && <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>❌ {result.error}</div>}
                </div>
              </div>

              {/* History */}
              <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 200, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="px-4 py-3 text-xs font-bold uppercase tracking-wider flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#4a5a6a' }}>History</div>
                <div className="overflow-y-auto flex-1">
                  {history.length === 0 ? <div className="p-4 text-xs text-center" style={{ color: '#4a5a6a' }}>No queries yet</div>
                  : history.map((h,i) => (
                    <div key={i} className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div className="flex justify-between text-xs mb-1"><span className="font-bold" style={{ color: '#14b8a6' }}>{h.tool.split(' ')[0]}</span><span style={{ color: '#f5a623' }}>{h.cost} 🔥</span></div>
                      <div className="text-xs font-mono" style={{ color: '#4a5a6a' }}>{h.input}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────────── */}
      <div className="md:hidden" style={{ background: '#050508', minHeight: '100vh', paddingBottom: 80 }}>
        <Navbar/>

        {/* Tool Selector — horizontal chips */}
        <div className="sticky top-14 z-30 px-4 pt-3 pb-2" style={{ background: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(20,184,166,0.1)' }}>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {TOOLS.map((t,i) => (
              <button key={t.id} onClick={() => { setActiveTool(i); setInput(''); setRunState('idle'); setResult(null) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0 text-xs font-bold transition-all"
                style={{ background: activeTool===i ? 'rgba(20,184,166,0.15)' : '#0a0a16', border: `1px solid ${activeTool===i ? '#14b8a6' : 'rgba(255,255,255,0.06)'}`, color: activeTool===i ? '#14b8a6' : '#7a8a9a', fontFamily:'inherit' }}>
                <span>{t.icon}</span> {t.shortName}
                <span className="ml-1 opacity-70">{t.cost} LDA</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-4">
          {/* Tool header */}
          <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'rgba(20,184,166,0.1)' }}>{tool.icon}</div>
            <div>
              <div className="font-bold">{tool.name}</div>
              <div className="text-xs" style={{ color: '#7a8a9a' }}>{tool.desc}</div>
            </div>
          </div>

          {/* Input */}
          <div className="mb-3">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#4a5a6a' }}>{tool.inputLabel}</div>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder={tool.placeholder}
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none font-mono"
              style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)', color: '#dde8f0' }}
              onFocus={e => e.target.style.borderColor = '#14b8a6'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}/>
          </div>

          {/* Cost */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4" style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-xs" style={{ color: '#7a8a9a' }}>Query cost</div>
            <div className="text-sm font-bold" style={{ color: '#f5a623' }}>🔥 {tool.cost} LDA ({Math.floor(tool.cost*.7)} burned)</div>
          </div>

          {/* CTA */}
          {!connected ? (
            <button onClick={connect} className="w-full py-4 rounded-xl font-extrabold text-base mb-4" style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', border:'none', fontFamily:'inherit' }}>
              Connect TronLink Wallet
            </button>
          ) : runState === 'idle' || runState === 'error' ? (
            <button onClick={runQuery} disabled={!input.trim()} className="w-full py-4 rounded-xl font-extrabold text-base mb-4 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', border:'none', fontFamily:'inherit' }}>
              ⚡ Run {tool.shortName} Analysis
            </button>
          ) : (
            <button disabled className="w-full py-4 rounded-xl font-extrabold text-base mb-4 flex items-center justify-center gap-3" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6', border:'none', fontFamily:'inherit' }}>
              <span className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: '#14b8a6', animation: 'spin 0.7s linear infinite' }}/>
              {runState === 'approving' ? 'Approving spend...' : 'Running AI analysis...'}
            </button>
          )}

          {/* Output */}
          {(runState === 'running' || runState === 'approving') && (
            <div className="p-4 rounded-xl font-mono text-xs mb-4" style={{ background: '#020208', border: '1px solid rgba(20,184,166,0.15)' }}>
              {['▶ Connecting to Tron node...', runState==='running'?'▶ Burn verified... confirmed':'▶ Awaiting approval...', runState==='running'?'▶ Fetching on-chain data...':'', runState==='running'?'▶ Running AI analysis...':''].filter(Boolean).map((l,i) => (
                <div key={i} className="py-0.5" style={{ color: i===0?'#14b8a6':i===1?'#22c55e':'#7a8a9a' }}>{l}</div>
              ))}
            </div>
          )}

          {runState === 'done' && result && !result.error && (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>✅ Analysis Complete</span>
                <div className="flex gap-2">
                  <button onClick={shareToX} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: tweetCopied?'rgba(29,161,242,0.15)':'rgba(29,161,242,0.08)', color: '#1da1f2', border:'1px solid rgba(29,161,242,0.2)', cursor:'pointer', fontFamily:'inherit' }}>
                    {tweetCopied ? '✅ Shared!' : '𝕏 Share'}
                  </button>
                  <button onClick={shareReport} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: copied?'rgba(34,197,94,0.1)':'rgba(20,184,166,0.08)', color: copied?'#22c55e':'#14b8a6', border:`1px solid ${copied?'rgba(34,197,94,0.2)':'rgba(20,184,166,0.2)'}`, cursor:'pointer', fontFamily:'inherit' }}>
                    {copied ? '✅ Copied!' : '🔗 Copy Link'}
                  </button>
                </div>
              </div>
              <ResultDisplay result={result}/>
            </div>
          )}

          {runState === 'error' && result?.error && (
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>❌ {result.error}</div>
          )}

          {/* Query History panel — mobile */}
          <div className="mt-4">
            <button onClick={() => setActivePanel(p => p === 'history' ? 'query' : 'history')} className="flex items-center justify-between w-full px-4 py-3 rounded-xl mb-2" style={{ background: '#0a0a16', border: `1px solid ${activePanel==='history'?'rgba(20,184,166,0.3)':'rgba(255,255,255,0.05)'}`, color: activePanel==='history'?'#14b8a6':'#7a8a9a', cursor:'pointer', fontFamily:'inherit' }}>
              <span className="text-xs font-bold uppercase tracking-wider">📜 Query History {history.length > 0 ? `(${history.length})` : ''}</span>
              <span>{activePanel==='history' ? '▲' : '▼'}</span>
            </button>
            {activePanel === 'history' && (
              history.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#4a5a6a', fontSize: 13 }}>No queries yet — run your first analysis above</div>
              ) : (
                <div className="space-y-2">
                  {history.map((h,i) => (
                    <div key={i} className="px-4 py-3 rounded-xl" style={{ background: '#0a0a16', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: '#14b8a6' }}>{h.tool}</span>
                        <span className="text-xs font-bold" style={{ color: '#f5a623' }}>{h.cost} LDA 🔥</span>
                      </div>
                      <div className="text-xs font-mono mb-1" style={{ color: '#7a8a9a' }}>{h.input}</div>
                      <div className="flex items-center justify-between">
                        {h.verdict && <span className="text-xs" style={{ color: '#dde8f0' }}>{h.verdict}</span>}
                        {h.score && <span className="text-xs font-bold" style={{ color: h.score >= 70 ? '#22c55e' : h.score >= 40 ? '#f5a623' : '#ef4444' }}>Score: {h.score}</span>}
                        <span className="text-xs" style={{ color: '#2a3a4a' }}>{h.time}</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setHistory([]); localStorage.removeItem('lionx_query_history') }} className="w-full text-xs py-2 rounded-xl" style={{ background:'transparent', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', cursor:'pointer', fontFamily:'inherit' }}>
                    Clear History
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function ResultDisplay({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      {result.score !== undefined && (
        <div className="relative rounded-xl p-4 overflow-hidden" style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.2)' }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a8a9a' }}>{result.scoreLabel}</div>
              <div className="text-5xl font-black font-mono" style={{ color: result.score>70?'#22c55e':result.score>40?'#f5a623':'#ef4444' }}>{result.score}</div>
              <div className="text-xs font-bold mt-1" style={{ color: result.score>70?'#22c55e':'#f5a623' }}>{result.verdict}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a8a9a' }}>Type</div>
              <div className="font-bold" style={{ color: '#14b8a6', fontSize: 13 }}>{result.type}</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0c0c18' }}>
            <div className="h-full rounded-full" style={{ width:`${result.score}%`, background:'linear-gradient(90deg,#14b8a6,#f5a623)', transition:'width 1s ease' }}/>
          </div>
        </div>
      )}
      {result.metrics && (
        <div className="grid grid-cols-3 gap-2">
          {result.metrics.map((m: any) => (
            <div key={m.label} className="p-3 rounded-xl" style={{ background: '#0e0e22', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5a6a', fontSize:10 }}>{m.label}</div>
              <div className="font-bold text-sm" style={{ color: m.color||'#14b8a6' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
      {result.analysis && (
        <div className="p-4 rounded-xl" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#14b8a6' }}>⚡ AI Analysis</div>
          <p className="text-sm leading-relaxed" style={{ color: '#7a8a9a' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.analysis, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['style'] }) }}/>
        </div>
      )}
      {result.flags && (
        <div className="p-4 rounded-xl" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#14b8a6' }}>🚩 Findings</div>
          {result.flags.map((f: any, i: number) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-sm border-b last:border-0" style={{ borderColor:'rgba(255,255,255,0.04)', color:'#7a8a9a' }}>
              <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: f.level==='ok'?'#22c55e':f.level==='warn'?'#f5a623':'#ef4444' }}/>
              {f.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
