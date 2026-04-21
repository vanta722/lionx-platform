/**
 * Migration 1 — Deploy LDA v2 Token
 *
 * Deploys the main LDA v2 contract.
 * Treasury wallet is set from environment variable.
 */

const LDAv2 = artifacts.require('LDAv2');

module.exports = async function(deployer, network, accounts) {
  const treasury = process.env.TREASURY_WALLET || accounts[0];

  console.log('\n──────────────────────────────────────');
  console.log(' Deploying LDA v2 Token');
  console.log('──────────────────────────────────────');
  console.log(` Network:  ${network}`);
  console.log(` Deployer: ${accounts[0]}`);
  console.log(` Treasury: ${treasury}`);
  console.log('──────────────────────────────────────\n');

  await deployer.deploy(LDAv2, treasury);
  const lda = await LDAv2.deployed();

  console.log(`\n✅ LDA v2 deployed at: ${lda.address}`);
  console.log(`   Max Supply: 10,000,000 LDA v2`);
  console.log(`   Decimals:   6`);
  console.log(`   Treasury:   ${treasury}\n`);

  // Save address for next migration
  process.env.LDA_V2_ADDRESS = lda.address;
};
