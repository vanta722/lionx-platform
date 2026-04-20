import Link from 'next/link'
import { useRouter } from 'next/router'
import { useWallet } from './WalletProvider'

const TIER_LABEL = ['', 'Bronze', 'Silver', 'Gold']
const TIER_COLOR = ['', '#cd7f32', '#c0c0c0', '#f5a623']

export default function Navbar() {
  const { address, balance, tier, connected, connect } = useWallet()
  const router = useRouter()

  const nav = [
    { href: '/',         label: 'Home'      },
    { href: '/tools',    label: 'AI Tools'  },
    { href: '/migrate',  label: 'Migrate'   },
    { href: '/stake',    label: 'Stake'     },
  ]

  return (
    <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4"
      style={{ background: 'rgba(5,5,8,0.9)', backdropFilter: 'blur(20px)',
               borderBottom: '1px solid rgba(20,184,166,0.15)' }}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span style={{ fontSize: 26, filter: 'drop-shadow(0 0 10px #f5a623)' }}>🦁</span>
        <span style={{ fontWeight: 900, fontSize: 18, color: '#f5a623', letterSpacing: -0.5 }}>
          LION<span style={{ color: '#14b8a6' }}>X</span>
        </span>
      </Link>

      {/* Nav Links */}
      <div className="hidden md:flex gap-1">
        {nav.map(n => (
          <Link key={n.href} href={n.href}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all no-underline"
            style={{
              color: router.pathname === n.href ? '#14b8a6' : '#7a8a9a',
              background: router.pathname === n.href ? 'rgba(20,184,166,0.1)' : 'transparent',
            }}>
            {n.label}
          </Link>
        ))}
      </div>

      {/* Wallet */}
      {connected && address ? (
        <div className="flex items-center gap-3">
          {tier > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-md"
              style={{ background: 'rgba(245,166,35,0.1)', color: TIER_COLOR[tier],
                       border: `1px solid ${TIER_COLOR[tier]}40` }}>
              {TIER_LABEL[tier]}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.16)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#14b8a6', boxShadow: '0 0 8px #14b8a6', animation: 'breathe 2s infinite' }} />
            <span className="text-xs font-mono" style={{ color: '#7a8a9a' }}>
              {address.slice(0,6)}...{address.slice(-4)}
            </span>
            <span className="text-xs font-bold" style={{ color: '#f5a623' }}>
              {balance.toLocaleString()} LDA
            </span>
          </div>
        </div>
      ) : (
        <button onClick={connect}
          className="text-sm font-bold px-5 py-2 rounded-lg transition-all"
          style={{ border: '1px solid #14b8a6', color: '#14b8a6', background: 'transparent' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = '#14b8a6'; (e.target as HTMLElement).style.color = '#000' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#14b8a6' }}>
          Connect Wallet
        </button>
      )}
    </nav>
  )
}
