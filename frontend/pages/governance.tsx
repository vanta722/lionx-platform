import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/Navbar'

export default function Governance() {
  return (
    <>
      <Head>
        <title>Governance | Lion X</title>
        <meta name="description" content="LDA v2 on-chain governance — coming in Phase 2" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#050508', paddingTop: 72, display: 'flex', flexDirection: 'column' }}>
        <Navbar />

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">

          {/* Animated icon */}
          <div style={{ fontSize: 64, marginBottom: 24, filter: 'drop-shadow(0 0 24px rgba(245,166,35,0.4))', animation: 'pulse 3s ease-in-out infinite' }}>
            🗳️
          </div>

          {/* Phase badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623', boxShadow: '0 0 8px #f5a623' }} />
            <span style={{ color: '#f5a623', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Phase 2 Feature
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: '#dde8f0', marginBottom: 16, lineHeight: 1.1 }}>
            LDA Governance
          </h1>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#14b8a6', marginBottom: 24 }}>
            Coming Soon
          </p>

          {/* Description */}
          <p style={{ color: '#7a8a9a', fontSize: 15, maxWidth: 480, lineHeight: 1.7, marginBottom: 40 }}>
            LDA v2 holders will vote on platform decisions — tool pricing, treasury allocation, builder approvals, and more. Every token = one vote. Every result recorded on-chain forever.
          </p>

          {/* Feature preview cards */}
          <div className="grid gap-4 w-full max-w-xl mb-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {[
              { icon: '📸', title: 'Snapshot Voting',   desc: 'Balances locked at proposal creation — no last-minute buys' },
              { icon: '⛓️', title: 'On-Chain Results',  desc: 'Every vote permanent and transparent on Tron' },
              { icon: '🏗️', title: 'Builder Approvals', desc: 'Community votes on marketplace additions' },
              { icon: '💰', title: 'Treasury Control',  desc: 'Holders decide how platform revenue is deployed' },
            ].map(f => (
              <div key={f.title} className="rounded-2xl p-4 text-left"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ color: '#dde8f0', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{f.title}</div>
                <div style={{ color: '#4a5a6a', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl px-6 py-5 mb-10 w-full max-w-md"
            style={{ background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#14b8a6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Roadmap
            </div>
            <div className="space-y-3">
              {[
                { phase: 'Phase 1', label: 'Platform Launch',        status: 'active',   note: 'AI tools + token live' },
                { phase: 'Phase 2', label: 'Governance + Staking',   status: 'upcoming', note: 'Voting + rewards' },
                { phase: 'Phase 3', label: 'Builder Marketplace',    status: 'future',   note: 'Community AI tools' },
              ].map(r => (
                <div key={r.phase} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                    background: r.status === 'active' ? '#22c55e' : r.status === 'upcoming' ? '#f5a623' : '#4a5a6a',
                    boxShadow: r.status === 'active' ? '0 0 8px #22c55e' : r.status === 'upcoming' ? '0 0 8px #f5a623' : 'none'
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#7a8a9a', width: 60, flexShrink: 0 }}>{r.phase}</span>
                  <span style={{ fontSize: 13, color: r.status === 'active' ? '#dde8f0' : '#7a8a9a', fontWeight: r.status === 'active' ? 700 : 400 }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#4a5a6a', marginLeft: 'auto' }}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/tools"
              className="px-6 py-3 rounded-xl font-bold text-sm no-underline transition-all"
              style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000' }}>
              ⚡ Use AI Tools Now
            </Link>
            <Link href="/migrate"
              className="px-6 py-3 rounded-xl font-bold text-sm no-underline transition-all"
              style={{ background: 'transparent', border: '1px solid rgba(20,184,166,0.3)', color: '#14b8a6' }}>
              🔄 Migrate to LDA v2
            </Link>
          </div>

          <p className="mt-8 text-xs" style={{ color: '#4a5a6a' }}>
            Hold LDA v2 now to have voting power when governance launches
          </p>

        </div>
      </div>
    </>
  )
}
