# Testnet Deployment Guide
## Lion X AI Platform — Tron Shasta

---

## Prerequisites

1. **TronLink wallet** installed in browser
2. **Shasta testnet TRX** — get free from faucet:
   👉 https://nileex.io/join/getJoinPage (Shasta faucet)
   👉 https://shasta.tronex.io (alternative)
3. **Node.js 18+** installed
4. **TronBox** installed: `npm install -g tronbox`

---

## Step 1 — Get Your Private Key

In TronLink:
1. Open TronLink → Settings → Account Management
2. Export private key (no 0x prefix needed)
3. Save it — you'll need it for .env

**USE A DEDICATED DEPLOYMENT WALLET — not your main wallet.**

---

## Step 2 — Set Up Environment

```bash
cd lionx-platform/tronbox
cp .env.example .env
```

Edit `.env`:
```
TRON_PRIVATE_KEY=your_64_char_private_key
TREASURY_WALLET=your_treasury_tron_address
```

---

## Step 3 — Get Shasta TRX

1. Open your deployment wallet in TronLink
2. Switch to Shasta Testnet
3. Copy your address
4. Go to: https://nileex.io/join/getJoinPage
5. Request test TRX (you need ~1000 TRX for deployments)

---

## Step 4 — Install Dependencies

```bash
cd tronbox
npm install
```

---

## Step 5 — Compile Contracts

```bash
npm run compile
# or: tronbox compile
```

Expected output:
```
Compiling ./contracts/LDAv2.sol...
Compiling ./contracts/LDAMigration.sol...
Compiling ./contracts/LDAPlatform.sol...
Writing artifacts to ./build/contracts
```

---

## Step 6 — Deploy to Shasta

```bash
npm run deploy:shasta
# or: tronbox migrate --network shasta --reset
```

Expected output:
```
Deploying LDA v2 Token...
✅ LDA v2 deployed at: T...
📦 Minting 10,000,000 LDA v2 to migration contract...
✅ 10M LDA v2 minted
🔓 Opening 30-day migration window...
✅ Migration window open — 30 days

Deploying LDA Platform Contract...
✅ Platform contract deployed at: T...
🔑 Authorizing platform contract on LDA v2...
✅ Platform authorized

🦁 LION X DEPLOYMENT SUMMARY
LDA v2:     T[your contract address]
Migration:  T[your contract address]
Platform:   T[your contract address]
```

---

## Step 7 — Verify on Tronscan (Shasta)

Visit: https://shasta.tronscan.org/#/contract/[your-address]

Confirm:
- [ ] Contract is deployed
- [ ] Source code verified
- [ ] Total supply shows 10,000,000
- [ ] Migration contract holds 10M tokens

---

## Step 8 — Update Frontend

In `frontend/lib/tron.ts`, update `CONTRACTS`:

```ts
export const CONTRACTS = {
  LDA_V1:    'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1',
  LDA_V2:    'T[your-ldav2-address]',
  MIGRATION: 'T[your-migration-address]',
  PLATFORM:  'T[your-platform-address]',
  STAKING:   '', // Phase 2
  MANES:     'TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d',
}
```

---

## Step 9 — Test the Flow

1. Connect TronLink to Shasta testnet
2. Approve migration contract to spend old LDA
3. Call `migrate(amount)` — receive LDA v2
4. Approve platform contract to spend LDA v2
5. Run a query via `executeQuery(toolId, queryRef)`
6. Verify burn on Tronscan — check totalBurned on contract

---

## Step 10 — Mainnet Checklist (before going live)

- [ ] All tests pass on Shasta
- [ ] Migration flow tested end-to-end
- [ ] Platform burnFrom verified working
- [ ] Frontend connects correctly on testnet
- [ ] Treasury wallet is a separate secure wallet
- [ ] Private key is NOT the same as treasury wallet
- [ ] Smart contract reviewed for edge cases
- [ ] LP liquidity ready to seed on SunSwap
- [ ] Community announcement prepared

**Only then:** `npm run deploy:mainnet`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `insufficient balance` | Get more Shasta TRX from faucet |
| `contract address not found` | Wait 30s for Shasta to confirm, retry |
| `feeLimit exceeded` | Increase feeLimit in tronbox.js |
| `private key invalid` | Confirm no 0x prefix, exactly 64 chars |
| `BANDWIDTH_ERROR` | Stake TRX for bandwidth or wait to recover |
