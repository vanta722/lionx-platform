/**
 * Tron / TronLink utility library
 * Handles wallet connection and LDA balance reads.
 * Platform uses direct LDA transfer model — no smart contract at launch.
 */

declare global {
  interface Window {
    tronWeb?: any;
    tronLink?: any;
  }
}

// ── Contract Addresses ──
export const CONTRACTS = {
  LDA_V1:  'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',  // LDA token (mainnet)
  MANES:   'TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d',
  STAKING: '',  // Phase 2
}

export const TOOL_IDS = {
  WALLET_ANALYZER:  'WALLET_ANALYZER',
  CONTRACT_AUDITOR: 'CONTRACT_AUDITOR',
  MARKET_INTEL:     'MARKET_INTEL',
  MLB_PICKS:        'MLB_PICKS',
}

export const TOOL_COSTS = {
  WALLET_ANALYZER:  50,
  CONTRACT_AUDITOR: 100,
  MARKET_INTEL:     25,
  MLB_PICKS:        75,
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

// ── LDA Token ──
// Single implementation — getLDAv1Balance was an identical duplicate, removed.
export async function getLDABalance(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.LDA_V1)
    const bal = await contract.balanceOf(address).call()
    return Number(bal) / 10 ** 6
  } catch {
    return 0
  }
}

export async function getMANESBalance(address: string): Promise<number> {
  try {
    const contract = await window.tronWeb.contract().at(CONTRACTS.MANES)
    const bal = await contract.balanceOf(address).call()
    return Number(bal) / 10 ** 18
  } catch {
    return 0
  }
}

export const TIER_LABELS: Record<number, string> = {
  0: 'No Tier', 1: 'Bronze', 2: 'Silver', 3: 'Gold',
}

export const TIER_COLORS: Record<number, string> = {
  0: '#6b7280', 1: '#cd7f32', 2: '#c0c0c0', 3: '#f5a623',
}

// ── Staking (Phase 2) ──

export async function stakeTokens(amount: number, lockOption: number): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  const tx = await contract.stake(Math.floor(amount * 10 ** 6), lockOption).send()
  return tx
}

export async function unstakeTokens(stakeIndex: number): Promise<string> {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  return contract.unstake(stakeIndex).send()
}

export async function getUserStakes(address: string) {
  const contract = await window.tronWeb.contract().at(CONTRACTS.STAKING)
  return contract.getStakes(address).call()
}

// ── Migration stub (legacy — no longer used) ──
export async function getMigrationStats() {
  return { open: false, deadline: 0, totalBurned: 0, totalIssued: 0, timeRemaining: 0 }
}
