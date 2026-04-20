import Head from 'next/head'
import DOMPurify from 'isomorphic-dompurify'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '../components/Navbar'

const TOOL_LABELS: Record<string, string> = {
  WALLET_ANALYZER:  '🔍 Wallet Analysis Report',
  CONTRACT_AUDITOR: '🛡️ Contract Audit Report',
  MARKET_INTEL:     '📊 Market Intelligence Report',
}

export default function Report() {
  const router = useRouter()
  const [data,    setData]    = useState<any>(null)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    const { d } = router.query
    if (!d || typeof d !== 'string') return
    try {
      const decoded = JSON.parse(atob(d))
      setData(decoded)
    } catch {
      setError('Invalid report link')
    }
  }, [router.query])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) return (
    <div style={{ background: '#050508', minHeight: '100vh' }}>
      <Navbar/>
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-30">❌</div>
          <p className="text-sm" style={{ color: '#7a8a9a' }}>Invalid or expired report link.</p>
          <Link href="/tools" className="inline-block mt-4 text-sm font-bold no-underline" style={{ color: '#14b8a6' }}>← Run a new analysis</Link>
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ background: '#050508', minHeight: '100vh' }}>
      <Navbar/>
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: '#14b8a6', animation: 'spin 0.7s linear infinite' }}/>
      </div>
    </div>
  )

  const { tool, input, result } = data
  const label = TOOL_LABELS[tool] || '⚡ Analysis Report'

  return (
    <>
      <Head>
        <title>{label} | Lion X</title>
        <meta name="description" content={`Lion X AI ${label} for ${input}`}/>
        <meta property="og:title" content={`${label} — Lion X AI Platform`}/>
        <meta property="og:description" content={`${result?.verdict || ''} — Analyzed by Lion X AI on Tron`}/>
      </Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>

        <main className="pt-28 pb-16 px-4 max-w-2xl mx-auto">

          {/* Report Header */}
          <div className="relative rounded-2xl p-6 mb-6 overflow-hidden" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.2)' }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg,#14b8a6,#f5a623,#14b8a6)', backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite' }}/>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#14b8a6' }}>Lion X AI Report</div>
                <h1 className="font-black text-xl mb-1 tracking-tight">{label}</h1>
                <div className="font-mono text-sm" style={{ color: '#7a8a9a' }}>{input}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={copyLink}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{ background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(20,184,166,0.08)', color: copied ? '#22c55e' : '#14b8a6', border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'rgba(20,184,166,0.2)'}` }}>
                  {copied ? '✅ Copied!' : '🔗 Copy Link'}
                </button>
                <Link href="/tools" className="px-4 py-2 rounded-lg text-xs font-bold text-center no-underline"
                  style={{ background: 'rgba(245,166,35,0.08)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.2)' }}>
                  Run Your Own →
                </Link>
              </div>
            </div>
          </div>

          {/* Score */}
          {result?.score !== undefined && (
            <div className="rounded-2xl p-6 mb-4" style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a8a9a' }}>{result.scoreLabel}</div>
                  <div className="text-5xl font-black font-mono" style={{ color: result.score > 70 ? '#22c55e' : result.score > 40 ? '#f5a623' : '#ef4444' }}>{result.score}</div>
                  <div className="text-sm font-bold mt-1" style={{ color: result.score > 70 ? '#22c55e' : '#f5a623' }}>{result.verdict}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a8a9a' }}>Classification</div>
                  <div className="font-bold text-lg" style={{ color: '#14b8a6' }}>{result.type}</div>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0c0c18' }}>
                <div className="h-full rounded-full" style={{ width: `${result.score}%`, background: 'linear-gradient(90deg,#14b8a6,#f5a623)', transition: 'width 1s ease' }}/>
              </div>
            </div>
          )}

          {/* Metrics */}
          {result?.metrics && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {result.metrics.map((m: any) => (
                <div key={m.label} className="p-3 rounded-xl" style={{ background: '#0e0e22', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5a6a' }}>{m.label}</div>
                  <div className="font-bold text-sm" style={{ color: m.color || '#14b8a6' }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Analysis */}
          {result?.analysis && (
            <div className="p-5 rounded-xl mb-4" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#14b8a6' }}>⚡ AI Analysis</div>
              <p className="text-sm leading-relaxed" style={{ color: '#7a8a9a' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.analysis, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['style'] }) }}/>
            </div>
          )}

          {/* Flags */}
          {result?.flags && (
            <div className="p-5 rounded-xl mb-6" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#14b8a6' }}>🚩 Findings</div>
              {result.flags.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-2 py-2 text-sm border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)', color: '#7a8a9a' }}>
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: f.level === 'ok' ? '#22c55e' : f.level === 'warn' ? '#f5a623' : '#ef4444' }}/>
                  {f.text}
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl p-6 text-center" style={{ background: '#0a0a16', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div className="text-2xl mb-2">🦁</div>
            <div className="font-black text-lg mb-1">Get Your Own Analysis</div>
            <p className="text-sm mb-4" style={{ color: '#7a8a9a' }}>Token-gated AI tools on Tron. Burn LDA to run queries.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/tools" className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000' }}>
                Try the Tools →
              </Link>
              <Link href="/dashboard" className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline"
                style={{ border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623', background: 'transparent' }}>
                Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
