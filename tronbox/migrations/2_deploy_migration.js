/**
 * Migration 2 — Deploy LDA Migration Contract
 */

const LDAv2        = artifacts.require('LDAv2');
const LDAMigration = artifacts.require('LDAMigration');

// Mainnet: real LDA v1 contract
const LDA_V1_MAINNET = 'TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1';

// Testnet: mock LDA v1 (already deployed on Shasta)
// TW6aNV8BjzDqCo7fBNM8S3Uwf8ExfKwWPq = mock LDA v1
const LDA_V1_SHASTA = process.env.LDA_V1_SHASTA || LDA_V1_MAINNET;

module.exports = async function(deployer, network, accounts) {
  const lda = await LDAv2.deployed();
  const v1Address = network === 'mainnet' ? LDA_V1_MAINNET : LDA_V1_SHASTA;

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

  const TEN_MILLION = '10000000000000';
  console.log('\n📦 Minting 10,000,000 LDA v2 to migration contract...');
  await lda.mint(migration.address, TEN_MILLION);
  console.log('✅ 10M LDA v2 minted — 100% allocated to community migration');

  console.log('\n🔓 Opening 30-day migration window...');
  await migration.openMigration(30);
  console.log('✅ Migration window open — 30 days\n');

  console.log('──────────────────────────────────────');
  console.log(` Migration contract: ${migration.address}`);
  console.log(` LDA v2 contract:    ${lda.address}`);
  console.log(` Mock LDA v1:        ${v1Address}`);
  console.log(` Ratio:              2 LDA v1 → 1 LDA v2`);
  console.log('──────────────────────────────────────\n');
};
