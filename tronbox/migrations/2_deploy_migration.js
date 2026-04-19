/**
 * Migration 2 — Deploy LDA Migration Contract
 *
 * Sets up the swap: old LDA (v1) → LDA v2 at 2:1 ratio.
 * After deployment: mint 10M LDA v2 to this contract.
 */

const LDAv2       = artifacts.require('LDAv2');
const LDAMigration = artifacts.require('LDAMigration');

// Original LDA v1 contract address (Tron mainnet)
const LDA_V1_ADDRESS = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1';

// Shasta testnet — deploy a mock v1 token or use placeholder
const LDA_V1_SHASTA  = process.env.LDA_V1_SHASTA || LDA_V1_ADDRESS;

module.exports = async function(deployer, network, accounts) {
  const lda = await LDAv2.deployed();

  const v1Address = network === 'mainnet' ? LDA_V1_ADDRESS : LDA_V1_SHASTA;

  console.log('\n──────────────────────────────────────');
  console.log(' Deploying LDA Migration Contract');
  console.log('──────────────────────────────────────');
  console.log(` Old LDA (v1): ${v1Address}`);
  console.log(` New LDA (v2): ${lda.address}`);
  console.log(` Ratio: 2 old → 1 new`);
  console.log('──────────────────────────────────────\n');

  await deployer.deploy(LDAMigration, v1Address, lda.address);
  const migration = await LDAMigration.deployed();

  console.log(`\n✅ Migration contract deployed at: ${migration.address}`);

  // Mint the full 10M LDA v2 supply to the migration contract
  // All tokens distributed to existing holders via migration
  const TEN_MILLION = '10000000000000'; // 10M * 10^6

  console.log('\n📦 Minting 10,000,000 LDA v2 to migration contract...');
  await lda.mint(migration.address, TEN_MILLION);
  console.log('✅ 10M LDA v2 minted — 100% allocated to community migration');

  // Open migration window for 30 days
  console.log('\n🔓 Opening 30-day migration window...');
  await migration.openMigration(30);
  console.log('✅ Migration window open — 30 days for holders to swap\n');

  console.log('──────────────────────────────────────');
  console.log(' MIGRATION SETUP COMPLETE');
  console.log('──────────────────────────────────────');
  console.log(` Migration contract: ${migration.address}`);
  console.log(` LDA v2 contract:    ${lda.address}`);
  console.log(` Window open:        30 days`);
  console.log(` Ratio:              2 LDA v1 → 1 LDA v2`);
  console.log('──────────────────────────────────────\n');
};
