import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'

const PHRASES = [
  'wallet analysis, contract audits & market intelligence.',
  'on-chain insights powered by LDA v2.',
  'the AI layer Tron has been waiting for.'
]

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [typeText, setTypeText] = useState('')
  const [countdown, setCountdown] = useState('30d 00h 00m 00s')

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const pts = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.4 + .3,
      c: Math.random() > .6 ? '#14b8a6' : Math.random() > .5 ? '#f5a623' : '#ffffff'
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.globalAlpha = .35; ctx.fillStyle = p.c
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 80) {
            ctx.globalAlpha = (1 - d / 80) * .07
            ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = .5
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  // Typewriter
  useEffect(() => {
    let pi = 0, ci = 0, deleting = false
    const tick = () => {
      const phrase = PHRASES[pi]
      if (!deleting) {
        setTypeText(phrase.slice(0, ci + 1)); ci++
        if (ci === phrase.length) { deleting = true; setTimeout(tick, 2200); return }
      } else {
        setTypeText(phrase.slice(0, ci - 1)); ci--
        if (ci === 0) { deleting = false; pi = (pi + 1) % PHRASES.length }
      }
      setTimeout(tick, deleting ? 40 : 65)
    }
    tick()
  }, [])

  // Countdown
  useEffect(() => {
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const t = setInterval(() => {
      const diff = end.getTime() - Date.now()
      if (diff <= 0) { setCountdown('Closed'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${d}d ${h}h ${m}m ${s}s`)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const stats = [
    { val: '20,207,717', label: 'Old LDA Supply' },
    { val: '10,000,000', label: 'LDA v2 Max Supply' },
    { val: '281',        label: 'Existing Holders' },
    { val: '0',          label: 'Tokens Burned' },
    { val: countdown,    label: 'Migration Window', live: true },
  ]

  const tools = [
    { icon: '🔍', name: 'Wallet Analyzer',   desc: 'Portfolio breakdown, trading patterns, whale/bot classification and risk score.', cost: 50  },
    { icon: '🛡️', name: 'Contract Auditor',  desc: 'Honeypot detection, rug scan, ownership analysis and red flag reporting.',        cost: 100 },
    { icon: '📊', name: 'Market Intelligence', desc: 'Sentiment, holder trends, buy/sell pressure and AI-powered market commentary.',  cost: 25  },
  ]

  return (
    <>
      <Head>
        <title>Lion X — AI Platform on Tron</title>
        <meta name="description" content="Token-gated AI tools for crypto. Burn LDA v2 to access wallet analysis, contract audits and market intelligence on Tron."/>
      </Head>

      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-40"/>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)'
      }}/>

      <Navbar/>

      {/* HERO */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%,rgba(20,184,166,0.09) 0%,transparent 60%)'
        }}/>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8"
            style={{ border: '1px solid rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.08)', color: '#2dd4bf' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#14b8a6', boxShadow: '0 0 8px #14b8a6', animation: 'breathe 2s infinite' }}/>
            Migration Now Live — Upgrade Your LDA
          </div>

          <h1 className="font-black leading-none tracking-tight mb-6" style={{ fontSize: 'clamp(44px,7.5vw,88px)', letterSpacing: -3 }}>
            The Future of<br/>
            <span style={{ background: 'linear-gradient(135deg,#14b8a6,#67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI-Powered</span><br/>
            <span style={{ background: 'linear-gradient(135deg,#f5a623,#ff9a00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 30px rgba(245,166,35,0.4))' }}>Crypto Tools</span>
          </h1>

          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#7a8a9a', lineHeight: 1.8 }}>
            Token-gated AI intelligence for Tron.<br/>
            <span style={{ borderRight: '2px solid #14b8a6', paddingRight: 3 }}>{typeText}</span>
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/migrate"
              className="px-8 py-3.5 rounded-xl font-extrabold text-base no-underline transition-all"
              style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000', boxShadow: '0 4px 20px rgba(245,166,35,0.25)' }}>
              🔄 Migrate to LDA v2
            </Link>
            <Link href="/tools"
              className="px-8 py-3.5 rounded-xl font-bold text-base no-underline transition-all"
              style={{ border: '1px solid #14b8a6', color: '#14b8a6', background: 'transparent' }}>
              Explore AI Tools →
            </Link>
          </div>

          <div className="mt-16 flex flex-col items-center gap-2" style={{ color: '#4a5a6a', animation: 'float 3s ease-in-out infinite' }}>
            <div style={{ width: 1, height: 40, background: 'linear-gradient(180deg,#14b8a6,transparent)' }}/>
            <span className="text-xs">scroll</span>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="relative z-10 flex justify-center gap-12 flex-wrap py-6 px-6"
        style={{ background: '#08080f', borderTop: '1px solid rgba(20,184,166,0.15)', borderBottom: '1px solid rgba(20,184,166,0.15)' }}>
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-black" style={{ background: 'linear-gradient(135deg,#2dd4bf,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {s.val}
            </div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: '#4a5a6a' }}>{s.label}</div>
            {s.live && <div className="flex items-center justify-center gap-1.5 mt-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'breathe 1.5s infinite' }}/><span className="text-xs font-bold" style={{ color: '#22c55e' }}>Live</span></div>}
          </div>
        ))}
      </div>

      {/* TOOLS PREVIEW */}
      <section className="relative z-10 py-24 px-4 max-w-5xl mx-auto text-center">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#14b8a6' }}>AI Tools</p>
        <h2 className="font-black mb-3 tracking-tight" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: -1.5 }}>What LDA v2 Unlocks</h2>
        <p className="text-sm mb-14 max-w-md mx-auto" style={{ color: '#7a8a9a', lineHeight: 1.75 }}>Three AI tools at launch. Burn LDA v2 to run a query. Every burn reduces supply.</p>

        <div className="grid md:grid-cols-3 gap-5">
          {tools.map((t, i) => (
            <div key={i} className="relative rounded-2xl p-8 text-left group transition-all duration-300 hover:-translate-y-1"
              style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.16)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#14b8a6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(20,184,166,0.16)')}>
              <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity shimmer-border"/>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)' }}>{t.icon}</div>
              <div className="font-bold text-lg mb-2">{t.name}</div>
              <div className="text-sm mb-5" style={{ color: '#7a8a9a', lineHeight: 1.65 }}>{t.desc}</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', color: '#f5a623' }}>
                🔥 {t.cost} LDA v2 per query
              </div>
              <span className="absolute top-4 right-4 text-xs font-bold px-2 py-1 rounded"
                style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', color: '#14b8a6' }}>
                Live at Launch
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/tools" className="inline-block px-8 py-3.5 rounded-xl font-bold text-base no-underline"
            style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', boxShadow: '0 4px 20px rgba(20,184,166,0.25)' }}>
            Open AI Tools Dashboard →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-4 text-center">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(20,184,166,0.06) 0%,transparent 70%)' }}/>
        <h2 className="font-black mb-4 relative" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: -2 }}>
          Don't Hold the{' '}
          <span style={{ background: 'linear-gradient(135deg,#f5a623,#ff9a00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Old Version.</span>
        </h2>
        <p className="text-base mb-10 relative" style={{ color: '#7a8a9a' }}>Migration window is live. Upgrade your position before it closes.</p>
        <Link href="/migrate"
          className="relative inline-block px-10 py-4 rounded-xl font-extrabold text-base no-underline"
          style={{ background: 'linear-gradient(135deg,#f5a623,#e08e00)', color: '#000', boxShadow: '0 6px 28px rgba(245,166,35,0.35)' }}>
          🔄 Migrate to LDA v2 Now
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 flex justify-between items-center flex-wrap gap-4 px-8 py-8"
        style={{ borderTop: '1px solid rgba(20,184,166,0.15)', background: '#08080f' }}>
        <span className="font-extrabold text-base" style={{ color: '#14b8a6' }}>🦁 LION X</span>
        <div className="flex gap-6">
          {[['Website','https://lionxeco.net'],['Twitter','https://twitter.com/LionX05494692'],['Telegram','https://t.me/Lionxone'],['Tronscan','https://tronscan.org/#/token20/TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1']].map(([l,h]) => (
            <a key={l} href={h} target="_blank" rel="noreferrer" className="text-xs no-underline transition-colors" style={{ color: '#4a5a6a' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#14b8a6')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4a5a6a')}>{l}</a>
          ))}
        </div>
        <span className="text-xs" style={{ color: '#4a5a6a' }}>© 2026 Lion X Ecosystem · Built on Tron</span>
      </footer>
    </>
  )
}
