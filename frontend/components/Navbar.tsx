import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useWallet } from './WalletProvider'

const TIER_LABEL = ['', 'Bronze', 'Silver', 'Gold']
const TIER_COLOR = ['', '#cd7f32', '#c0c0c0', '#f5a623']

export default function Navbar() {
  const { address, balance, tier, connected, connect } = useWallet()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = [
    { href: '/',             label: 'Home',        icon: '🏠' },
    { href: '/tools',        label: 'AI Tools',    icon: '⚡' },
    { href: '/dashboard',    label: 'Dashboard',   icon: '📊' },
    { href: '/governance',   label: 'Governance',  icon: '🗳️' },
    { href: '/marketplace',  label: 'Marketplace', icon: '🏪' },
    { href: '/migrate',      label: 'Migrate',     icon: '🔄' },
  ]

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-4 md:px-6 py-3 md:py-4"
        style={{ background: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(20px)',
                 borderBottom: '1px solid rgba(20,184,166,0.15)' }}>

        {/* Logo */}
        <Link href="/" onClick={closeMenu} className="flex items-center gap-2 no-underline">
          <span style={{ fontSize: 24, filter: 'drop-shadow(0 0 8px #f5a623)' }}>🦁</span>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#f5a623', letterSpacing: -0.5 }}>
            LION<span style={{ color: '#14b8a6' }}>X</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-1">
          {nav.map(n => (
            <Link key={n.href} href={n.href}
              className="px-3 py-2 rounded-lg text-sm font-semibold transition-all no-underline"
              style={{ color: router.pathname === n.href ? '#14b8a6' : '#7a8a9a',
                       background: router.pathname === n.href ? 'rgba(20,184,166,0.1)' : 'transparent' }}>
              {n.label}
            </Link>
          ))}
        </div>

        {/* Right: Wallet + Hamburger */}
        <div className="flex items-center gap-2">
          {/* Wallet — compact on mobile */}
          {connected && address ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: '#0e0e22', border: '1px solid rgba(20,184,166,0.16)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#14b8a6', boxShadow: '0 0 6px #14b8a6' }} />
              <span className="text-xs font-mono hidden sm:inline" style={{ color: '#7a8a9a' }}>
                {address.slice(0,4)}...{address.slice(-3)}
              </span>
              <span className="text-xs font-bold" style={{ color: '#f5a623' }}>
                {balance.toLocaleString()} LDA
              </span>
            </div>
          ) : (
            <button onClick={connect}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ border: '1px solid #14b8a6', color: '#14b8a6', background: 'transparent', fontFamily: 'inherit' }}>
              Connect
            </button>
          )}

          {/* Hamburger */}
          <button className="md:hidden flex flex-col justify-center gap-1 p-2 rounded-lg"
            style={{ background: menuOpen ? 'rgba(20,184,166,0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}
            onClick={() => setMenuOpen(o => !o)}>
            <span style={{ display:'block', width:20, height:2, background: menuOpen ? '#14b8a6' : '#7a8a9a', transition:'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(4px)' : 'none' }}/>
            <span style={{ display:'block', width:20, height:2, background: menuOpen ? '#14b8a6' : '#7a8a9a', transition:'all 0.2s', opacity: menuOpen ? 0 : 1 }}/>
            <span style={{ display:'block', width:20, height:2, background: menuOpen ? '#14b8a6' : '#7a8a9a', transition:'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-4px)' : 'none' }}/>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={closeMenu}>
          <div className="absolute top-14 left-0 right-0 py-3 px-4" style={{ background: 'rgba(5,5,8,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(20,184,166,0.15)' }}
            onClick={e => e.stopPropagation()}>
            {nav.map(n => (
              <Link key={n.href} href={n.href} onClick={closeMenu}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 no-underline transition-all"
                style={{ background: router.pathname === n.href ? 'rgba(20,184,166,0.1)' : 'transparent',
                         color: router.pathname === n.href ? '#14b8a6' : '#dde8f0',
                         borderLeft: router.pathname === n.href ? '2px solid #14b8a6' : '2px solid transparent' }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span className="font-semibold text-sm">{n.label}</span>
                {router.pathname === n.href && <span className="ml-auto text-xs" style={{ color: '#14b8a6' }}>●</span>}
              </Link>
            ))}
            {!connected && (
              <button onClick={() => { connect(); closeMenu() }}
                className="w-full mt-2 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#000', border: 'none', fontFamily: 'inherit' }}>
                Connect TronLink Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
