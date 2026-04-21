import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/Navbar'

export default function Migrate() {
  return (
    <>
      <Head>
        <title>No Migration Needed | Lion X</title>
      </Head>
      <div style={{ minHeight: '100vh', background: '#050508', paddingTop: 72, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div style={{ fontSize: 56, marginBottom: 20 }}>🦁</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#dde8f0', marginBottom: 12 }}>
            No Migration Required
          </h1>
          <p style={{ color: '#7a8a9a', fontSize: 15, maxWidth: 420, lineHeight: 1.7, marginBottom: 32 }}>
            Good news — the Lion X platform runs on the <strong style={{ color: '#14b8a6' }}>existing LDA token</strong> you already hold. No token swap, no fees, no friction. Just connect your wallet and start using AI tools.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/tools"
              className="px-6 py-3 rounded-xl font-bold text-sm no-underline"
              style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000' }}>
              ⚡ Start Using AI Tools
            </Link>
            <Link href="/"
              className="px-6 py-3 rounded-xl font-bold text-sm no-underline"
              style={{ background: 'transparent', border: '1px solid rgba(20,184,166,0.3)', color: '#14b8a6' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
