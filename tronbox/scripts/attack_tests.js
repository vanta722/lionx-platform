/**
 * LDAPlatform Attack Test Suite
 * Tries to break the contract every way possible.
 * Run: node scripts/attack_tests.js
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────
require('dotenv').config();

const PRIVATE_KEY    = process.env.TRON_PRIVATE_KEY;
const PLATFORM_ADDR  = 'TFsJm4XijuoSsT5EeH7z6AQUBLgE4i9mSM';
const LDA_ADDR       = 'TXSv4xiqHNhYmDVrjntoqSfZihrh2BEd2s';
const TREASURY_ADDR  = 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy';

const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  privateKey: PRIVATE_KEY,
});

// Attacker wallet (different key — simulated)
const ATTACKER_KEY = 'a' + PRIVATE_KEY.slice(1); // slightly different key
const attackerWeb  = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  privateKey: ATTACKER_KEY,
});

// ── Helpers ─────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0, warnings = 0;

function log(icon, label, detail = '') {
  console.log(`${icon}  ${label}${detail ? ' — ' + detail : ''}`);
}
function pass(label, detail) { log('✅', label, detail); passed++; }
function fail(label, detail) { log('❌', label, detail); failed++; }
function warn(label, detail) { log('⚠️ ', label, detail); warnings++; }

async function loadABI(name) {
  const buildPath = path.join(__dirname, '../build/contracts', `${name}.json`);
  const artifact  = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
  return artifact.abi;
}

// ── Main ────────────────────────────────────────────────────────
async function runAttacks() {
  console.log('\n🔴 LDA Platform — Attack Test Suite');
  console.log('════════════════════════════════════════\n');

  const [platformABI, ldaABI] = await Promise.all([
    loadABI('LDAPlatform'),
    loadABI('MockLDAv1'),
  ]);

  const platform = await tronWeb.contract(platformABI, PLATFORM_ADDR);
  const lda      = await tronWeb.contract(ldaABI, LDA_ADDR);

  const owner = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
  console.log(`Owner wallet:    ${owner}`);
  console.log(`Platform:        ${PLATFORM_ADDR}`);
  console.log(`LDA Token:       ${LDA_ADDR}`);
  console.log('════════════════════════════════════════\n');

  // ── Test 0: Sanity check — read tool prices ───────────────────
  console.log('— BLOCK 0: Sanity Checks —');
  try {
    const walletToolId = tronWeb.sha3('wallet_analyzer');
    const tool = await platform.tools(walletToolId).call();
    const price = Number(tool.price) / 1e6;
    if (price === 50) pass('Tool prices correct', `Wallet Analyzer = ${price} LDA`);
    else fail('Tool price mismatch', `Expected 50, got ${price}`);
  } catch(e) {
    fail('Cannot read tool', e.message);
  }
  await sleep(1000);

  // ── Test 1: executeQuery with no approval ─────────────────────
  console.log('\n— BLOCK 1: Authorization Attacks —');
  try {
    const toolId = tronWeb.sha3('wallet_analyzer');
    await platform.executeQuery(toolId, 'fake_tx_hash_no_approval').send({ feeLimit: 100_000_000 });
    fail('No-approval attack', 'Query executed without token approval — CRITICAL');
  } catch(e) {
    pass('No-approval blocked', 'transferFrom correctly reverts without approval');
  }
  await sleep(2000);

  // ── Test 2: Zero amount approval ─────────────────────────────
  try {
    const toolId = tronWeb.sha3('wallet_analyzer');
    await lda.approve(PLATFORM_ADDR, 0).send({ feeLimit: 100_000_000 });
    await sleep(2000);
    await platform.executeQuery(toolId, 'zero_approval_hash').send({ feeLimit: 100_000_000 });
    fail('Zero-approval attack', 'Query executed with 0 approval — CRITICAL');
  } catch(e) {
    pass('Zero-approval blocked', 'Correctly reverts on zero allowance');
  }
  await sleep(2000);

  // ── Test 3: Fake toolId ───────────────────────────────────────
  try {
    await lda.approve(PLATFORM_ADDR, 1_000_000_000).send({ feeLimit: 100_000_000 });
    await sleep(2000);
    const fakeToolId = tronWeb.sha3('totally_fake_tool_xyz');
    await platform.executeQuery(fakeToolId, 'fake_tool_hash').send({ feeLimit: 100_000_000 });
    fail('Fake toolId attack', 'Executed query for non-existent tool — CRITICAL');
  } catch(e) {
    pass('Fake toolId blocked', 'Non-existent tool correctly reverts');
  }
  await sleep(2000);

  // ── Test 4: Replay attack — same txHash twice ─────────────────
  console.log('\n— BLOCK 2: Replay Attacks —');
  try {
    const toolId = tronWeb.sha3('market_intel'); // cheapest = 25 LDA
    const dupHash = 'replay_attack_test_hash_' + Date.now();

    // First query — should work (if we have balance)
    let firstOk = false;
    try {
      await platform.executeQuery(toolId, dupHash).send({ feeLimit: 100_000_000 });
      firstOk = true;
      await sleep(3000);
    } catch(e) {
      warn('First query failed', e.message.slice(0, 80) + ' (may be balance issue)');
    }

    // Second query — same txHash, should ALWAYS revert
    try {
      await platform.executeQuery(toolId, dupHash).send({ feeLimit: 100_000_000 });
      fail('Replay attack', 'Same txHash executed TWICE — replay protection broken');
    } catch(e) {
      pass('Replay blocked', 'Duplicate txHash correctly reverts');
    }
  } catch(e) {
    warn('Replay test error', e.message.slice(0, 80));
  }
  await sleep(2000);

  // ── Test 5: Empty txHash ──────────────────────────────────────
  try {
    const toolId = tronWeb.sha3('market_intel');
    await platform.executeQuery(toolId, '').send({ feeLimit: 100_000_000 });
    fail('Empty txHash attack', 'Executed with empty txHash — MEDIUM');
  } catch(e) {
    pass('Empty txHash blocked', 'Empty hash correctly reverts');
  }
  await sleep(2000);

  // ── Test 6: Unauthorized owner functions ──────────────────────
  console.log('\n— BLOCK 3: Privilege Escalation —');
  const attackerAddress = attackerWeb.address.fromPrivateKey(ATTACKER_KEY);
  const attackerPlatform = await attackerWeb.contract(platformABI, PLATFORM_ADDR);

  try {
    await attackerPlatform.setToolPrice(
      tronWeb.sha3('wallet_analyzer'),
      1 // 0.000001 LDA — attacker tries to set price to near-zero
    ).send({ feeLimit: 100_000_000 });
    fail('Price manipulation', `Attacker (${attackerAddress.slice(0,8)}...) changed tool price — CRITICAL`);
  } catch(e) {
    pass('Price change blocked', 'Non-owner cannot change tool prices');
  }
  await sleep(2000);

  try {
    await attackerPlatform.pause().send({ feeLimit: 100_000_000 });
    fail('Unauthorized pause', 'Non-owner paused the contract — HIGH');
  } catch(e) {
    pass('Unauthorized pause blocked', 'Only owner can pause');
  }
  await sleep(2000);

  try {
    await attackerPlatform.registerBuilder(
      attackerAddress,
      tronWeb.sha3('malicious_tool'),
      'Malicious Tool'
    ).send({ feeLimit: 100_000_000 });
    fail('Unauthorized builder reg', 'Non-owner registered a builder — HIGH');
  } catch(e) {
    pass('Unauthorized builder blocked', 'Only owner can register builders');
  }
  await sleep(2000);

  try {
    await attackerPlatform.setTreasury(attackerAddress).send({ feeLimit: 100_000_000 });
    fail('Treasury hijack', 'Attacker redirected treasury — CRITICAL');
  } catch(e) {
    pass('Treasury hijack blocked', 'Non-owner cannot change treasury address');
  }
  await sleep(2000);

  // ── Test 7: Integer overflow / underflow ──────────────────────
  console.log('\n— BLOCK 4: Overflow / Edge Cases —');
  try {
    // Try to set a tool price that would overflow uint256
    const MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    await platform.setToolPrice(tronWeb.sha3('wallet_analyzer'), MAX_UINT)
      .send({ feeLimit: 100_000_000 });
    warn('MAX_UINT price set', 'Accepted max uint256 as price — check if this is intentional');
  } catch(e) {
    pass('MAX_UINT price rejected', 'Overflow edge case handled');
  }
  await sleep(2000);

  // ── Test 8: Pause → executeQuery ──────────────────────────────
  console.log('\n— BLOCK 5: Pause Mechanism —');
  try {
    await platform.pause().send({ feeLimit: 100_000_000 });
    await sleep(3000);

    const toolId = tronWeb.sha3('market_intel');
    try {
      await platform.executeQuery(toolId, 'paused_query_test').send({ feeLimit: 100_000_000 });
      fail('Paused query executed', 'Query ran while contract was PAUSED — CRITICAL');
    } catch(e) {
      pass('Paused query blocked', 'executeQuery correctly reverts when paused');
    }

    // Unpause
    await platform.unpause().send({ feeLimit: 100_000_000 });
    await sleep(3000);
    pass('Pause/unpause cycle', 'Owner can pause and unpause');
  } catch(e) {
    warn('Pause test error', e.message.slice(0, 80));
  }

  // ── Test 9: Direct TRX send (no payable) ──────────────────────
  console.log('\n— BLOCK 6: Unexpected Inputs —');
  try {
    const contractHex = tronWeb.address.toHex(PLATFORM_ADDR);
    await tronWeb.trx.sendTransaction(contractHex, 1_000_000); // 1 TRX
    await sleep(2000);
    warn('TRX accepted', 'Contract accepted direct TRX — verify no payable fallback issues');
  } catch(e) {
    pass('TRX rejected', 'Contract correctly rejects direct TRX sends');
  }

  // ── Test 10: 70/30 split math verification ────────────────────
  console.log('\n— BLOCK 7: Split Math Verification —');
  try {
    const toolId = tronWeb.sha3('market_intel'); // 25 LDA
    const burnBefore    = await lda.balanceOf(TREASURY_ADDR).call(); // burn = treasury on testnet
    const treasBefore   = Number(burnBefore) / 1e6;

    // Approve + execute
    await lda.approve(PLATFORM_ADDR, 25_000_000).send({ feeLimit: 100_000_000 });
    await sleep(2000);
    await platform.executeQuery(toolId, 'split_math_test_' + Date.now())
      .send({ feeLimit: 100_000_000 });
    await sleep(4000);

    const burnAfter   = await lda.balanceOf(TREASURY_ADDR).call();
    const treasAfter  = Number(burnAfter) / 1e6;
    const received    = treasAfter - treasBefore;

    // On testnet burn = treasury, so should receive 70% + 30% = 100%... 
    // Actually both go to treasury on testnet so should be 25 LDA total
    if (Math.abs(received - 25) < 0.01) {
      pass('Split math correct', `25 LDA in → ${received.toFixed(6)} LDA received by treasury`);
    } else if (received > 0) {
      warn('Split math mismatch', `Expected 25 LDA received ${received.toFixed(6)} — check split logic`);
    } else {
      warn('Split math not verified', 'Could not measure balance change — may be balance issue');
    }
  } catch(e) {
    warn('Split math test error', e.message.slice(0, 100));
  }

  // ── Results ───────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('  ATTACK TEST RESULTS');
  console.log('════════════════════════════════════════');
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log('════════════════════════════════════════');

  if (failed === 0) {
    console.log('\n🟢 ALL CRITICAL ATTACKS BLOCKED — contract is solid');
  } else {
    console.log(`\n🔴 ${failed} ATTACK(S) SUCCEEDED — DO NOT DEPLOY TO MAINNET`);
  }

  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warnings to review before mainnet`);
  }

  console.log('\nPlatform address (Shasta):', PLATFORM_ADDR);
  console.log('View on Tronscan: https://shasta.tronscan.org/#/contract/' + PLATFORM_ADDR + '\n');
}

runAttacks().catch(e => {
  console.error('\n💥 Fatal error:', e.message);
  process.exit(1);
});
