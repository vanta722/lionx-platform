import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface WalletCtx {
  address:   string | null
  balance:   number
  tier:      number
  connected: boolean
  connect:   () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletCtx>({
  address: null, balance: 0, tier: 0, connected: false,
  connect: async () => {}, disconnect: () => {}
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address,   setAddress]   = useState<string | null>(null)
  const [balance,   setBalance]   = useState(0)
  const [tier,      setTier]      = useState(0)
  const [connected, setConnected] = useState(false)

  const LDA_V1 = process.env.NEXT_PUBLIC_LDA_V1 || ''

  async function connect() {
    try {
      if (typeof window === 'undefined' || !window.tronLink) {
        window.open('https://www.tronlink.org/', '_blank')
        return
      }
      const res = await window.tronLink.request({ method: 'tron_requestAccounts' })
      if (res.code !== 200) return
      const addr = window.tronWeb?.defaultAddress?.base58
      if (!addr) return
      setAddress(addr)
      setConnected(true)
      await refreshBalance(addr)
    } catch (e) {
      console.error('Wallet connect error:', e)
    }
  }

  async function refreshBalance(addr: string) {
    try {
      if (!window.tronWeb || !LDA_V1) return
      const contract = await window.tronWeb.contract().at(LDA_V1)
      const bal = await contract.balanceOf(addr).call()
      setBalance(Number(bal) / 1e6)
    } catch (e) { console.error('[lionx] balance fetch:', e) }
    // getTier is platform contract only — skip on plain LDA token
    setTier(0)
  }

  function disconnect() {
    setAddress(null)
    setBalance(0)
    setTier(0)
    setConnected(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const interval = setInterval(() => {
      const addr = window.tronWeb?.defaultAddress?.base58
      if (addr && !connected) { setAddress(addr); setConnected(true); refreshBalance(addr) }
      if (!addr && connected) disconnect()
    }, 2000)
    return () => clearInterval(interval)
  }, [connected])

  return (
    <WalletContext.Provider value={{ address, balance, tier, connected, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
