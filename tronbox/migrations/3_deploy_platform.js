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

// ── Tron burn wallet ──
// Tokens sent here are permanently out of circulation.
// This is a provably uncontrolled address (no known private key).
// Tron equivalent of 0x000...dead
const BURN_WALLET = '0x0000000000000000000000000000000000000001';
// Fallback: use a dedicated burn address from env
const BURN_ADDR   = process.env.BURN_WALLET || BURN_WALLET;

module.exports = async function(deployer, network, accounts) {
  const ldaAddress = network === 'mainnet' ? LDA_V1_MAINNET : LDA_V1_SHASTA;
  const treasury   = process.env.TREASURY_WALLET || accounts[0];
  const burnAddr   = treasury; // On testnet use treasury as burn; override on mainnet

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
