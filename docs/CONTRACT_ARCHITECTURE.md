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
3. Deploy `LDAStaking.sol(newLDA)`
4. Deploy `LDAPlatform.sol(newLDA)`
5. On LDAv2: `setAuthorizedPlatform(platformAddress, true)`
6. On LDAv2: `setStakingContract(stakingAddress)`
7. On LDAv2: `mint(migrationContract, 10_000_000)` → 10M for migration pool
8. On LDAv2: `mint(owner, 5_000_000)` → 5M for LP + team
9. On LDAv2: `mint(stakingContract, 2_000_000)` → 2M for staking rewards
10. On LDAv2: `mint(treasury, 3_000_000)` → 3M for platform reserve

Total minted at launch = 20M (hard cap hit, no further minting)

## Token Allocation at Launch

| Allocation        | Amount  | %   |
|-------------------|---------|-----|
| Migration pool    | 10M     | 50% |
| LP seed           | 2M      | 10% |
| Team (vested)     | 3M      | 15% |
| Staking rewards   | 2M      | 10% |
| Platform reserve  | 3M      | 15% |
| **Total**         | **20M** | 100%|

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
