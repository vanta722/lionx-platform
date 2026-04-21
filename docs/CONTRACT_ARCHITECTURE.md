# LDA v2 Smart Contract Architecture

## Contract Overview

```
LDAv2.sol          ← Main token (deploy first)
LDAMigration.sol   ← Old LDA → v2 swap (needs LDAv2 address)
LDAStaking.sol     ← Lock LDA v2 for rewards (needs LDAv2 address)
LDAPlatform.sol    ← AI query gateway (needs LDAv2 address)
```

## Deployment Order

1. Deploy `LDAv2.sol` → get LDA v2 contract address
2. Deploy `LDAMigration.sol(oldLDA, newLDA)`
3. Deploy `LDAPlatform.sol(newLDA)`
4. On LDAv2: `setAuthorizedPlatform(platformAddress, true)`

> LDAStaking.sol deployed in Phase 2 once treasury has volume.
7. On LDAv2: `mint(migrationContract, 10_000_000)` → 10M for migration pool

Total minted at launch = 10M (hard cap hit, no further minting)
LP + staking rewards funded from platform transaction revenue — no pre-allocation.

## Token Allocation at Launch

| Allocation        | Amount  | %   |
|-------------------|---------|-----|
| Migration pool    | 10M     | 100% |
| **Total**         | **10M** | 100% |

> LP seed, staking rewards, and platform reserve are funded
> organically from transaction revenue — not pre-minted.
> Staking launches in Phase 2 once treasury has real volume.

## Burn Mechanics

Every AI query:
```
User balance -= 100 LDA v2
→ 70 LDA v2 burned (totalSupply reduced permanently)
→ 30 LDA v2 → treasury wallet
   → if tool has builder: builder gets builderShare% of 30
   → remainder goes to platform treasury
```

## Tier Thresholds

| Tier   | Hold Amount  | Query Discount |
|--------|--------------|----------------|
| Bronze | 500 LDA v2   | 5%             |
| Silver | 2,000 LDA v2 | 10%            |
| Gold   | 10,000 LDA v2| 20%            |

## Staking Lock Options

| Period | Multiplier | Notes                    |
|--------|-----------|--------------------------|
| 30d    | 1.0x      | Entry level              |
| 90d    | 1.5x      | Recommended for most     |
| 180d   | 2.5x      | Power stakers            |
| 365d   | 4.0x      | Diamond hands            |

Early exit: 20% penalty on principal (goes to reward pool)
Gold tier bonus: +10% on all staking rewards

## Snapshot Voting

- Owner creates a snapshot (captures block + supply)
- Holders vote FOR/AGAINST with their current balance as weight
- No quorum enforced on-chain (governance is advisory at Phase 1)
- Results stored on-chain, execution manual by team
- Phase 3: move to on-chain execution via DAO

## Builder Revenue Share

When a builder registers a tool:
- Tool has a `sharePercent` of the 30% treasury cut
- Example: tool costs 100 LDA v2
  - 70 burned
  - 30 to treasury split
  - If builder gets 50% share: 15 to builder, 15 to platform
- Builder earns passively from every use of their tool
- Max builder share: 80% of treasury portion (platform always keeps 20%+)

## Security Notes

- Only authorized platform contracts can call `burnFrom()`
- 2-step ownership transfer (prevents accidental renounce)
- Emergency pause on all transfers
- Burn split bounded: burn must be 50–90% (prevents treasury abuse)
- No reentrancy risk (state updated before external calls)
- Builder share capped at 80%

## Tools on Tronbox

```bash
# Install TronBox
npm install -g tronbox

# Compile
tronbox compile

# Deploy to Shasta testnet first
tronbox migrate --network shasta

# Deploy to mainnet
tronbox migrate --network mainnet
```
