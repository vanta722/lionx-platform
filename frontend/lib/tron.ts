/**
 * Tron / TronLink utility library
 * Handles wallet connection, contract calls, and LDA interactions
 */

declare global {
  interface Window {
    tronWeb?: any;
    tronLink?: any;
  }
}

// ── Contract Addresses ──
// Platform now uses existing LDA v1 token directly — no new token needed.
// Only ONE contract to deploy: LDAPlatform.sol
export const CONTRACTS = {
  LDA_V1:    'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',  // LDA token (mainnet)
  PLATFORM:  process.env.NEXT_PUBLIC_PLATFORM || 'TQMc3D4Q6WAZmDuDj5ySZ4dMNKd87rgVPD', // update after mainnet deploy
  STAKING:   '',   // Phase 2
  MANES:     'TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d',
}

export const TOOL_IDS = {
  WALLET_ANALYZER:  'WALLET_ANALYZER',
  CONTRACT_AUDITOR: 'CONTRACT_AUDITOR',
  MARKET_INTEL:     'MARKET_INTEL',
}

export const TOOL_COSTS = {
  WALLET_ANALYZER:  50,
  CONTRACT_AUDITOR: 100,
  MARKET_INTEL:     25,
}

// ── Wallet Connection ──

export async function connectTronLink(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  if (!window.tronLink) {
    window.open('https://www.tronlink.org/', '_blank')
    throw new Error('TronLink not installed. Please install TronLink wallet.')
  }

  const res = await window.tronLink.request({ method: 'tron_requestAccounts' })
  if (res.code !== 200) throw new Error('TronLink connection rejected')

  return window.tronWeb?.defaultAddress?.base58 || null
}

export function isConnected(): boolean {
  return !!(window?.tronWeb?.defaultAddress?.base58)
}

export function getAddress(): string | null {
  return window?.tronWeb?.defaultAddress?.base58 || null
}

export function truncateAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// ── LDA v2 Token Calls ──

export async function getLDABalance(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.LDA_V1)
    const bal = await contract.balanceOf(address).call()
    return Number(bal) / 10**6
  } catch {
    return 0
  }
}

export async function getLDAv1Balance(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.LDA_V1)
    const bal = await contract.balanceOf(address).call()
    return Number(bal) / 10**6
  } catch {
    return 0
  }
}

export async function getMANESBalance(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.MANES)
    const bal = await contract.balanceOf(address).call()
    return Number(bal) / 10**18
  } catch {
    return 0
  }
}

export async function getUserTier(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.LDA_V1)
    const tier = await contract.getTier(address).call()
    return Number(tier)
  } catch {
    return 0
  }
}

export const TIER_LABELS: Record<number, string> = {
  0: 'No Tier',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
}

export const TIER_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#cd7f32',
  2: '#c0c0c0',
  3: '#f5a623',
}

// ── Approval + Query Execution ──

/**
 * Approve platform contract to spend LDA on user's behalf.
 * Must be called before first query (or when allowance runs low).
 */
export async function approvePlatform(amount: number): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.LDA_V1)
  const amountSun = Math.floor(amount * 10**6)
  const tx = await contract.approve(CONTRACTS.PLATFORM, amountSun).send()
  return tx
}

/**
 * Execute an AI query — burns LDA.
 * Emits QueryExecuted event that backend picks up.
 */
export async function executeQuery(toolId: string, queryRef: string): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.PLATFORM)
  // Use keccak256 hash — must match how the Platform contract registered the tool
  // LDAPlatform.sol uses: _registerTool(keccak256("WALLET_ANALYZER"), ...)
  const toolIdBytes = window.tronWeb.sha3(toolId)  // keccak256 hash
  const queryRefBytes = window.tronWeb.sha3(queryRef)
  const tx = await contract.executeQuery(toolIdBytes, queryRefBytes).send()
  return tx
}

// ── Legacy (unused) ──


// Placeholder to avoid import errors
export async function getMigrationStats() {
  return {
    open:          false,
    deadline:      0,
    totalBurned: 0,
    totalIssued:   0,
    timeRemaining: 0,
  }
}

// ── Staking ──

export async function stakeTokens(amount: number, lockOption: number): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  const amountSun = Math.floor(amount * 10**6)
  const tx = await contract.stake(amountSun, lockOption).send()
  return tx
}

export async function unstakeTokens(stakeIndex: number): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  const tx = await contract.unstake(stakeIndex).send()
  return tx
}

export async function getUserStakes(address: string) {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  const stakes = await contract.getStakes(address).call()
  return stakes
}

// ── Tronscan API ──

export async function getWalletData(address: string) {
  const res = await fetch(`https://apilist.tronscanapi.com/api/accountv2?address=${address}`)
  return res.json()
}

export async function getTokenInfo(contractAddress: string) {
  const res = await fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${contractAddress}`)
  return res.json()
}
