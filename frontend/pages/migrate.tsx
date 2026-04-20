import Head from 'next/head'
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'

type Step = 'idle' | 'approving' | 'migrating' | 'done' | 'error'

export default function Migrate() {
  const { address, connected, connect } = useWallet()
  const [v1Balance,  setV1Balance]  = useState(0)
  const [v2Balance,  setV2Balance]  = useState(0)
  const [amount,     setAmount]     = useState('')
  const [step,       setStep]       = useState<Step>('idle')
  const [txHash,     setTxHash]     = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [stats,      setStats]      = useState({ open: false, timeRemaining: 0, totalMigrated: 0 })

  const MIGRATION = process.env.NEXT_PUBLIC_MIGRATION || ''
  const LDA_V1    = process.env.NEXT_PUBLIC_LDA_V1    || ''
  const LDA_V2    = process.env.NEXT_PUBLIC_LDA_V2    || ''

  const receiveAmount = amount ? Math.floor(Number(amount) / 2) : 0

  useEffect(() => {
    if (!connected || !address) return
    loadBalances()
    loadStats()
  }, [connected, address])

  async function loadBalances() {
    try {
      const tw = window.tronWeb
      if (!tw) return
      const v1c = await tw.contract().at(LDA_V1)
      const v2c = await tw.contract().at(LDA_V2)
      const b1 = await v1c.balanceOf(address).call()
      const b2 = await v2c.balanceOf(address).call()
      setV1Balance(Number(b1) / 1e6)
      setV2Balance(Number(b2) / 1e6)
    } catch {}
  }

  async function loadStats() {
    try {
      const tw = window.tronWeb
      if (!tw) return
      const mc = await tw.contract().at(MIGRATION)
      const s = await mc.stats().call()
      setStats({ open: s[0], timeRemaining: Number(s[4]), totalMigrated: Number(s[2]) / 1e6 })
    } catch {}
  }

  async function handleMigrate() {
    if (!connected || !address || !amount) return
    const amtNum = Number(amount)
    if (amtNum <= 0 || amtNum % 2 !== 0) { setErrorMsg('Amount must be a positive even number (2:1 ratio)'); return }
    if (amtNum > v1Balance) { setErrorMsg('Insufficient LDA v1 balance'); return }

    const tw = window.tronWeb
    if (!tw) return

    setErrorMsg('')
    try {
      // Step 1: Approve
      setStep('approving')
      const v1c = await tw.contract().at(LDA_V1)
      const amtSun = amtNum * 1e6
      await v1c.approve(MIGRATION, amtSun.toString()).send({ feeLimit: 100_000_000 })
      await new Promise(r => setTimeout(r, 5000)) // wait for confirmation

      // Step 2: Migrate
      setStep('migrating')
      const mc = await tw.contract().at(MIGRATION)
      const tx = await mc.migrate(amtSun.toString()).send({ feeLimit: 300_000_000 })
      setTxHash(tx)
      await new Promise(r => setTimeout(r, 5000))

      setStep('done')
      await loadBalances()
    } catch (e: any) {
      setStep('error')
      setErrorMsg(e?.message || 'Transaction failed. Please try again.')
    }
  }

  const daysLeft = Math.floor(stats.timeRemaining / 86400)

  return (
    <>
      <Head><title>Migrate LDA → LDA v2 | Lion X</title></Head>
      <div style={{ background: '#050508', minHeight: '100vh' }}>
        <Navbar/>

        <main className="relative z-10 pt-32 pb-24 px-4 max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#14b8a6' }}>Token Migration</p>
            <h1 className="font-black text-4xl mb-3 tracking-tight">Upgrade Your LDA</h1>
            <p className="text-sm" style={{ color: '#7a8a9a' }}>Swap original LDA for LDA v2 · 2:1 ratio · {daysLeft > 0 ? `${daysLeft} days remaining` : 'Migration open'}</p>
          </div>

          {/* Migration Card */}
          <div className="relative rounded-2xl p-8" style={{ background: '#0a0a16', border: '1px solid rgba(20,184,166,0.18)' }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl shimmer-border"/>

            {/* Balances */}
            {connected && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl text-center" style={{ background: '#0c0c18' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5a6a' }}>LDA v1 Balance</div>
                  <div className="text-xl font-black" style={{ color: '#f5a623' }}>{v1Balance.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: '#0c0c18' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5a6a' }}>LDA v2 Balance</div>
                  <div className="text-xl font-black" style={{ color: '#14b8a6' }}>{v2Balance.toLocaleString()}</div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="mb-2">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#4a5a6a' }}>You Send</div>
              <div className="relative">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Enter LDA v1 amount..."
                  className="w-full text-2xl font-black px-5 py-4 rounded-xl outline-none"
                  style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)', color: 'white', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#14b8a6'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}/>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623', fontSize: 14, fontWeight: 700 }}>
                  🦁 LDA
                </div>
              </div>
              {connected && <button onClick={() => setAmount(String(Math.floor(v1Balance / 2) * 2))} className="mt-1 text-xs" style={{ color: '#14b8a6', background: 'none', border: 'none', cursor: 'pointer' }}>MAX</button>}
            </div>

            {/* Arrow */}
            <div className="text-center py-3 text-2xl" style={{ color: '#14b8a6', filter: 'drop-shadow(0 0 6px #14b8a6)' }}>↓</div>

            {/* Output */}
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#4a5a6a' }}>You Receive</div>
              <div className="flex items-center justify-between px-5 py-4 rounded-xl"
                style={{ background: '#0c0c18', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-2xl font-black">{receiveAmount > 0 ? receiveAmount.toLocaleString() : '—'}</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#2dd4bf', fontSize: 14, fontWeight: 700 }}>
                  ⚡ LDA v2
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="mb-6 rounded-xl p-4" style={{ background: '#0c0c18' }}>
              {[['Exchange Rate','2 LDA v1 = 1 LDA v2'],['Network','Tron (TRC-20)'],['Est. Gas','~0.1 TRX'],['Total Migrated',`${stats.totalMigrated.toLocaleString()} LDA v1`]].map(([k,v]) => (
                <div key={k} className="flex justify-between text-sm py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#7a8a9a' }}>{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {errorMsg && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>{errorMsg}</div>}

            {/* Success */}
            {step === 'done' && txHash && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                ✅ Migration complete! <a href={`https://tronscan.org/#/transaction/${txHash}`} target="_blank" rel="noreferrer" className="underline">View on Tronscan</a>
              </div>
            )}

            {/* CTA Button */}
            {!connected ? (
              <button onClick={connect} className="w-full py-4 rounded-xl font-extrabold text-base transition-all"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', boxShadow: '0 4px 20px rgba(20,184,166,0.25)' }}>
                Connect TronLink Wallet
              </button>
            ) : step === 'idle' || step === 'error' ? (
              <button onClick={handleMigrate} disabled={!amount || Number(amount) <= 0}
                className="w-full py-4 rounded-xl font-extrabold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', boxShadow: '0 4px 20px rgba(20,184,166,0.25)' }}>
                ⚡ Confirm Migration
              </button>
            ) : step === 'approving' ? (
              <button disabled className="w-full py-4 rounded-xl font-extrabold text-base flex items-center justify-center gap-3" style={{ background: 'rgba(20,184,166,0.2)', color: '#14b8a6' }}>
                <span className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: '#14b8a6', animation: 'spin 0.7s linear infinite' }}/>
                Approving LDA v1 spend...
              </button>
            ) : step === 'migrating' ? (
              <button disabled className="w-full py-4 rounded-xl font-extrabold text-base flex items-center justify-center gap-3" style={{ background: 'rgba(245,166,35,0.2)', color: '#f5a623' }}>
                <span className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: '#f5a623', animation: 'spin 0.7s linear infinite' }}/>
                Broadcasting on Tron...
              </button>
            ) : (
              <button onClick={() => setStep('idle')} className="w-full py-4 rounded-xl font-extrabold text-base" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff' }}>
                ✅ Migration Complete — Migrate More?
              </button>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
