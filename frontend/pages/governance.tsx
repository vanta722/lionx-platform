import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '../components/Navbar'
import { useWallet } from '../components/WalletProvider'

const TEAL  = '#14b8a6'
const GOLD  = '#f5a623'
const BG    = '#050508'
const CARD  = '#08080f'
const BORDER = 'rgba(20,184,166,0.12)'

const LDA_V2   = process.env.NEXT_PUBLIC_LDA_V2   || 'TURQgDcWWeg633Azz8SMrDrHHYdgM3Nfxi'
const NETWORK  = process.env.NEXT_PUBLIC_NETWORK  || 'shasta'

// ── Types ──────────────────────────────────────────────────
interface Proposal {
  id:           number
  description:  string
  blockNumber:  number
  totalSupply:  number
  active:       boolean
  forVotes:     number
  againstVotes: number
  hasVoted?:    boolean
  myWeight?:    number
}

// ── Helpers ────────────────────────────────────────────────
function pct(a: number, b: number) {
  const total = a + b
  if (total === 0) return { for: 50, against: 50 }
  return { for: Math.round((a / total) * 100), against: Math.round((b / total) * 100) }
}

function fmtLDA(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

// ── Page ───────────────────────────────────────────────────
export default function Governance() {
  const { address, connected, connect } = useWallet()

  const [proposals, setProposals]     = useState<Proposal[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Proposal | null>(null)
  const [voting, setVoting]           = useState(false)
  const [voteTx, setVoteTx]           = useState('')
  const [voteError, setVoteError]     = useState('')
  const [myVotePower, setMyVotePower] = useState(0)
  const [filter, setFilter]           = useState<'all' | 'active' | 'closed'>('all')

  // ── Load proposals from chain ──────────────────────────
  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const tw = (window as any).tronWeb
      if (!tw) { setLoading(false); return }

      const contract = await tw.contract().at(LDA_V2)
      const count    = Number(await contract.snapshotCount().call())

      const loaded: Proposal[] = []
      for (let i = 1; i <= count; i++) {
        try {
          const s         = await contract.snapshots(i).call()
          const results   = await contract.getVoteResults(i).call()
          const hasVoted  = connected && address
            ? await contract.hasVoted(i, address).call()
            : false

          let myWeight = 0
          if (connected && address && Number(s.blockNumber) > 0) {
            try {
              myWeight = Number(await contract.getPriorBalance(address, Number(s.blockNumber)).call()) / 1e6
            } catch { myWeight = 0 }
          }

          loaded.push({
            id:           i,
            description:  s.description,
            blockNumber:  Number(s.blockNumber),
            totalSupply:  Number(results.totalSupplyAt) / 1e6,
            active:       s.active,
            forVotes:     Number(results.forVotes)     / 1e6,
            againstVotes: Number(results.againstVotes) / 1e6,
            hasVoted,
            myWeight,
          })
        } catch { /* skip bad entries */ }
      }

      setProposals(loaded.reverse()) // newest first
    } catch (e) {
      console.error('fetchProposals:', e)
    }
    setLoading(false)
  }, [address, connected])

  // ── Voting power for active proposals ─────────────────
  const fetchVotingPower = useCallback(async () => {
    if (!connected || !address) return
    try {
      const tw       = (window as any).tronWeb
      const contract = await tw.contract().at(LDA_V2)
      const bal      = Number(await contract.balanceOf(address).call()) / 1e6
      setMyVotePower(bal)
    } catch { setMyVotePower(0) }
  }, [address, connected])

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).tronWeb) {
      fetchProposals()
      fetchVotingPower()
    } else {
      const t = setTimeout(() => { fetchProposals(); fetchVotingPower() }, 2000)
      return () => clearTimeout(t)
    }
  }, [fetchProposals, fetchVotingPower])

  // ── Cast vote ─────────────────────────────────────────
  async function castVote(proposalId: number, support: boolean) {
    if (!connected || !address) return
    setVoting(true)
    setVoteTx('')
    setVoteError('')
    try {
      const tw       = (window as any).tronWeb
      const contract = await tw.contract().at(LDA_V2)
      const tx       = await contract.vote(proposalId, support).send({ feeLimit: 100_000_000 })
      setVoteTx(tx)
      await new Promise(r => setTimeout(r, 4000))
      await fetchProposals()
      setSelected(null)
    } catch (e: any) {
      setVoteError(e?.message || 'Vote failed — check TronLink')
    }
    setVoting(false)
  }

  const filtered = proposals.filter(p =>
    filter === 'all'    ? true :
    filter === 'active' ? p.active :
    !p.active
  )

  // ── Render ─────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Governance | Lion X</title>
        <meta name="description" content="Vote on Lion X platform proposals using your LDA v2 balance" />
      </Head>

      <div style={{ minHeight: '100vh', background: BG, paddingTop: 72 }}>
        <Navbar />

        <div className="max-w-4xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontSize: 32 }}>🗳️</span>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#dde8f0', margin: 0 }}>
                LDA Governance
              </h1>
            </div>
            <p style={{ color: '#7a8a9a', fontSize: 14, margin: 0 }}>
              LDA v2 holders vote on platform decisions. Your voting weight is locked at the snapshot block — tokens bought after a proposal is created don&apos;t count.
            </p>
          </div>

          {/* Voting power card */}
          <div className="mb-6 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div>
              <div style={{ color: '#7a8a9a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Your Voting Power
              </div>
              {connected ? (
                <div style={{ fontSize: 26, fontWeight: 900, color: GOLD }}>
                  {fmtLDA(myVotePower)} <span style={{ fontSize: 14, color: '#7a8a9a', fontWeight: 500 }}>LDA v2</span>
                </div>
              ) : (
                <div style={{ fontSize: 16, color: '#7a8a9a' }}>Connect wallet to see voting power</div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!connected && (
                <button onClick={connect}
                  style={{ background: `linear-gradient(135deg,${TEAL},#0d9488)`, color: '#000', border: 'none',
                           padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Connect TronLink
                </button>
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#7a8a9a' }}>Network</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NETWORK === 'mainnet' ? '#22c55e' : GOLD }}>
                  {NETWORK.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="mb-6 rounded-2xl p-5" style={{ background: 'rgba(20,184,166,0.05)', border: `1px solid rgba(20,184,166,0.15)` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              How Governance Works
            </div>
            <div className="grid gap-3 sm:grid-cols-3" style={{ fontSize: 13, color: '#7a8a9a' }}>
              {[
                { icon: '📸', title: 'Snapshot Created', text: 'Owner creates a proposal. Your LDA v2 balance is locked at that block.' },
                { icon: '🗳️', title: 'Cast Your Vote', text: 'Vote FOR or AGAINST using your locked balance. 1 LDA v2 = 1 vote.' },
                { icon: '📋', title: 'Results On-Chain', text: 'All votes are recorded on Tron. Results are transparent and permanent.' },
              ].map(s => (
                <div key={s.title} className="flex gap-3">
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#dde8f0', marginBottom: 2 }}>{s.title}</div>
                    <div>{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-5">
            {(['all', 'active', 'closed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '6px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', textTransform: 'capitalize',
                  background: filter === f ? TEAL : 'transparent',
                  color:      filter === f ? '#000' : '#7a8a9a',
                  border: `1px solid ${filter === f ? TEAL : BORDER}`,
                  transition: 'all 0.15s',
                }}>
                {f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8a9a', alignSelf: 'center' }}>
              {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Proposal list */}
          {loading ? (
            <div className="text-center py-16" style={{ color: '#7a8a9a' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div>Loading proposals from chain...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗳️</div>
              <div style={{ color: '#dde8f0', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                {filter === 'active' ? 'No active proposals' : 'No proposals yet'}
              </div>
              <div style={{ color: '#7a8a9a', fontSize: 13 }}>
                Governance proposals are created by the Lion X team.<br />
                Hold LDA v2 to participate when the first proposal goes live.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => {
                const votes = pct(p.forVotes, p.againstVotes)
                const total = p.forVotes + p.againstVotes
                return (
                  <div key={p.id}
                    onClick={() => setSelected(p)}
                    className="rounded-2xl p-5 cursor-pointer transition-all"
                    style={{ background: CARD, border: `1px solid ${selected?.id === p.id ? TEAL : BORDER}`,
                             boxShadow: selected?.id === p.id ? `0 0 0 1px ${TEAL}22` : 'none' }}>

                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8a9a' }}>#{p.id}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                          background: p.active ? 'rgba(20,184,166,0.15)' : 'rgba(107,114,128,0.15)',
                          color:      p.active ? TEAL : '#6b7280',
                          border: `1px solid ${p.active ? 'rgba(20,184,166,0.3)' : 'rgba(107,114,128,0.3)'}`,
                        }}>
                          {p.active ? '● ACTIVE' : '✓ CLOSED'}
                        </span>
                        {p.hasVoted && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>✔ You voted</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#7a8a9a' }}>
                        Block #{p.blockNumber.toLocaleString()}
                      </div>
                    </div>

                    <p style={{ color: '#dde8f0', fontWeight: 600, fontSize: 15, margin: '0 0 12px' }}>
                      {p.description}
                    </p>

                    {/* Vote bar */}
                    <div className="mb-2">
                      <div className="flex rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ width: `${votes.for}%`, background: '#22c55e', transition: 'width 0.5s' }} />
                        <div style={{ width: `${votes.against}%`, background: '#ef4444', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: '#7a8a9a' }}>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>
                        ✓ FOR {votes.for}% ({fmtLDA(p.forVotes)} LDA)
                      </span>
                      <span style={{ color: '#6b7280' }}>
                        {fmtLDA(total)} total votes
                      </span>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>
                        ✗ AGAINST {votes.against}% ({fmtLDA(p.againstVotes)} LDA)
                      </span>
                    </div>

                    {/* CTA */}
                    {p.active && connected && !p.hasVoted && (
                      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 12, color: TEAL, fontWeight: 600 }}>
                          Your weight on this proposal: {fmtLDA(p.myWeight || 0)} LDA v2 — click to vote
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Vote modal */}
          {selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
              onClick={() => { if (!voting) setSelected(null) }}>
              <div className="rounded-2xl w-full max-w-lg p-6"
                style={{ background: '#0d0d1a', border: `1px solid ${TEAL}40` }}
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between mb-4">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8a9a', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Proposal #{selected.id}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#7a8a9a', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>

                <p style={{ color: '#dde8f0', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
                  {selected.description}
                </p>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Your Weight', value: fmtLDA(selected.myWeight || 0) + ' LDA', color: GOLD },
                    { label: 'FOR Votes',   value: fmtLDA(selected.forVotes) + ' LDA',     color: '#22c55e' },
                    { label: 'AGAINST',     value: fmtLDA(selected.againstVotes) + ' LDA', color: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 10, color: '#7a8a9a', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Already voted */}
                {selected.hasVoted && (
                  <div className="rounded-xl p-4 text-center mb-4"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ color: '#22c55e', fontWeight: 700 }}>✔ You already voted on this proposal</div>
                  </div>
                )}

                {/* Closed */}
                {!selected.active && (
                  <div className="rounded-xl p-4 text-center mb-4"
                    style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)' }}>
                    <div style={{ color: '#6b7280', fontWeight: 700 }}>This proposal is closed</div>
                  </div>
                )}

                {/* Vote buttons */}
                {selected.active && !selected.hasVoted && connected && (
                  <>
                    {(selected.myWeight || 0) === 0 ? (
                      <div className="rounded-xl p-4 text-center mb-4"
                        style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
                        <div style={{ color: GOLD, fontWeight: 700, marginBottom: 4 }}>No voting power on this proposal</div>
                        <div style={{ color: '#7a8a9a', fontSize: 13 }}>
                          Your LDA v2 balance at block #{selected.blockNumber.toLocaleString()} was 0.<br />
                          Hold LDA v2 before the next snapshot to participate.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => castVote(selected.id, true)} disabled={voting}
                          style={{ padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: voting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: voting ? 0.6 : 1,
                                   background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', transition: 'all 0.15s' }}>
                          {voting ? '⏳ Voting...' : '✓ Vote FOR'}
                        </button>
                        <button onClick={() => castVote(selected.id, false)} disabled={voting}
                          style={{ padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: voting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: voting ? 0.6 : 1,
                                   background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', transition: 'all 0.15s' }}>
                          {voting ? '⏳ Voting...' : '✗ Vote AGAINST'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Not connected */}
                {selected.active && !connected && (
                  <button onClick={connect}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                             background: `linear-gradient(135deg,${TEAL},#0d9488)`, color: '#000', border: 'none' }}>
                    Connect TronLink to Vote
                  </button>
                )}

                {/* Success */}
                {voteTx && (
                  <div className="rounded-xl p-4 mt-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>✅ Vote submitted!</div>
                    <a href={`https://${NETWORK === 'mainnet' ? '' : 'shasta.'}tronscan.org/#/transaction/${voteTx}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: TEAL, fontSize: 12, textDecoration: 'underline' }}>
                      View on Tronscan →
                    </a>
                  </div>
                )}

                {/* Error */}
                {voteError && (
                  <div className="rounded-xl p-4 mt-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>⚠ {voteError}</div>
                  </div>
                )}

                <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <a href={`https://${NETWORK === 'mainnet' ? '' : 'shasta.'}tronscan.org/#/contract/${LDA_V2}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#7a8a9a', textDecoration: 'none' }}>
                    View LDA v2 contract on Tronscan ↗
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
