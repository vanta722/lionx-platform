import Head from 'next/head'
import Navbar from '../components/Navbar'

export default function Stake() {
  return (
    <>
      <Head><title>Stake LDA v2 | Lion X</title></Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>
        <main className="relative z-10 flex flex-col items-center justify-center text-center" style={{ minHeight: '100vh' }}>
          <div className="text-6xl mb-6 opacity-30">🔒</div>
          <h1 className="font-black text-3xl mb-3 tracking-tight">Staking — Phase 2</h1>
          <p className="text-sm max-w-sm" style={{ color: '#7a8a9a', lineHeight: 1.75 }}>
            LDA v2 staking launches after the platform reaches initial transaction volume.
            Rewards will be funded by real treasury income — not minted from nothing.
          </p>
          <div className="mt-8 px-6 py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', color: '#14b8a6' }}>
            Coming in Phase 2
          </div>
        </main>
      </div>
    </>
  )
}
