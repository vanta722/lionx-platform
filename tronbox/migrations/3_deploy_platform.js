/**
 * Migration 3 — Deploy LDA Platform (LDA v1 compatible)
 *
 * Deploys ONLY the platform contract.
 * No new token. No migration contract.
 * Works directly with existing LDA v1 on mainnet.
 *
 * Usage:
 *   tronbox migrate --network mainnet --f 3 --to 3
 */

const LDAPlatform = artifacts.require('LDAPlatform');

// ── LDA v1 mainnet contract ──
const LDA_V1_MAINNET = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1';

// ── Shasta testnet mock LDA v1 ──
const LDA_V1_SHASTA  = process.env.LDA_V1_SHASTA || LDA_V1_MAINNET;

// ── Tron black hole address ──
// TLsV52sRDL79HXGGm9ypuXy6KnR4LMMB7H = Tron all-zeros address
// Tokens sent here are permanently unrecoverable — no known private key.
// Visible on Tronscan as a dead accumulation address.
const TRON_BLACK_HOLE = 'TLsV52sRDL79HXGGm9ypuXy6KnR4LMMB7H';

module.exports = async function(deployer, network, accounts) {
  const ldaAddress = network === 'mainnet' ? LDA_V1_MAINNET : LDA_V1_SHASTA;
  const treasury   = process.env.TREASURY_WALLET || accounts[0];
  // Mainnet: use Tron black hole. Testnet: use treasury (so we can verify tokens arrive)
  const burnAddr   = network === 'mainnet' ? TRON_BLACK_HOLE : treasury;

  console.log('\n══════════════════════════════════════════');
  console.log(' Deploying LDA Platform (v1 Token Mode)');
  console.log('══════════════════════════════════════════');
  console.log(` Network:     ${network}`);
  console.log(` Deployer:    ${accounts[0]}`);
  console.log(` LDA Token:   ${ldaAddress} (v1 — no new token needed)`);
  console.log(` Treasury:    ${treasury}`);
  console.log(` Burn Wallet: ${burnAddr}`);
  console.log('══════════════════════════════════════════\n');

  await deployer.deploy(LDAPlatform, ldaAddress, treasury, burnAddr);
  const platform = await LDAPlatform.deployed();

  console.log(`\n✅ Platform deployed at: ${platform.address}`);
  console.log('\n📋 Tools registered at deployment:');
  console.log('   - Wallet Analyzer    (50 LDA)');
  console.log('   - Contract Auditor   (100 LDA)');
  console.log('   - Market Intelligence (25 LDA)');

  console.log('\n══════════════════════════════════════════');
  console.log(' DEPLOYMENT COMPLETE — ONE CONTRACT');
  console.log('══════════════════════════════════════════');
  console.log(` Platform:  ${platform.address}`);
  console.log(` LDA Token: ${ldaAddress} (existing — no changes)`);
  console.log(` Treasury:  ${treasury}`);
  console.log('\n⚡ Users approve this contract then call executeQuery()');
  console.log('   70% → burn wallet | 30% → treasury');
  console.log('══════════════════════════════════════════\n');
};
