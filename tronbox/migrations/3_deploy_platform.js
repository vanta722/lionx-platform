/**
 * Migration 3 — Deploy LDA Platform Contract
 *
 * The AI query gateway.
 * After deployment: authorize it on LDA v2 so it can call burnFrom().
 */

const LDAv2       = artifacts.require('LDAv2');
const LDAPlatform = artifacts.require('LDAPlatform');

module.exports = async function(deployer, network, accounts) {
  const lda = await LDAv2.deployed();

  console.log('\n──────────────────────────────────────');
  console.log(' Deploying LDA Platform Contract');
  console.log('──────────────────────────────────────');
  console.log(` LDA v2: ${lda.address}`);
  console.log('──────────────────────────────────────\n');

  await deployer.deploy(LDAPlatform, lda.address);
  const platform = await LDAPlatform.deployed();

  console.log(`\n✅ Platform contract deployed at: ${platform.address}`);

  // Authorize the platform contract to call burnFrom() on LDA v2
  console.log('\n🔑 Authorizing platform contract on LDA v2...');
  await lda.setAuthorizedPlatform(platform.address, true);
  console.log('✅ Platform authorized — can now burn LDA v2 on behalf of users\n');

  console.log('──────────────────────────────────────');
  console.log(' PLATFORM SETUP COMPLETE');
  console.log('──────────────────────────────────────');
  console.log(` Platform contract: ${platform.address}`);
  console.log(` Tools registered:`);
  console.log(`   - Wallet Analyzer   (50 LDA v2)`);
  console.log(`   - Contract Auditor  (100 LDA v2)`);
  console.log(`   - Market Intel      (25 LDA v2)`);
  console.log('──────────────────────────────────────\n');

  // Final summary
  console.log('\n🦁 LION X DEPLOYMENT SUMMARY');
  console.log('══════════════════════════════════════');
  console.log(` Network:    ${network}`);
  console.log(` LDA v2:     ${lda.address}`);
  console.log(` Migration:  (see migration 2 output)`);
  console.log(` Platform:   ${platform.address}`);
  console.log('══════════════════════════════════════');
  console.log(' Save these addresses! Update frontend/lib/tron.ts');
  console.log('══════════════════════════════════════\n');
};
