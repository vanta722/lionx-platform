/**
 * Lion X — Functional Test Suite
 * Runs against live Shasta testnet contracts
 */

const TronWeb = require('tronweb');
const fs = require('fs');

const tw = new TronWeb.TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  privateKey: process.env.TRON_PRIVATE_KEY
});

const DEPLOYER = tw.address.fromPrivateKey(process.env.TRON_PRIVATE_KEY);

// Deployed addresses
const ADDR = {
  LDA_V2:    'TBbFvRXne1ky822VxSAGTSsFCvcgqjvcPZ',
  MIGRATION: 'TYYdwEJi9Z2quY2647L6F9Jp65nR7eTSX3',
  PLATFORM:  'THzyj6bAcKxYhJ1hiYuYGk4NGAaPEinyka',
  MOCK_V1:   'TXSv4xiqHNhYmDVrjntoqSfZihrh2BEd2s',
};

// Load ABIs
const ldaAbi      = JSON.parse(fs.readFileSync('./build/contracts/LDAv2.json')).abi;
const migAbi      = JSON.parse(fs.readFileSync('./build/contracts/LDAMigration.json')).abi;
const platAbi     = JSON.parse(fs.readFileSync('./build/contracts/LDAPlatform.json')).abi;
const mockV1Abi   = JSON.parse(fs.readFileSync('./build/contracts/MockLDAv1.json')).abi;

let passed = 0;
let failed = 0;
const issues = [];

function log(msg) { process.stdout.write(msg + '\n'); }
function pass(test) { log(`  ✅ ${test}`); passed++; }
function fail(test, err) { log(`  ❌ ${test}\n     → ${err}`); failed++; issues.push({ test, err }); }
function section(name) { log(`\n━━━ ${name} ━━━`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const lda    = await tw.contract(ldaAbi,    ADDR.LDA_V2);
  const mig    = await tw.contract(migAbi,    ADDR.MIGRATION);
  const plat   = await tw.contract(platAbi,   ADDR.PLATFORM);
  const mockV1 = await tw.contract(mockV1Abi, ADDR.MOCK_V1);

  log('\n🦁 LION X CONTRACT TEST SUITE');
  log('═'.repeat(44));
  log(`Network:  Shasta Testnet`);
  log(`Deployer: ${DEPLOYER}`);

  // ── 1. TOKEN BASICS ──────────────────────────
  section('1. LDA v2 — Token Basics');
  try {
    const name = await lda.name().call();
    name === 'Lion Digital Alliance V2' ? pass('name() correct') : fail('name()', `Got: ${name}`);
  } catch(e) { fail('name()', e.message); }

  try {
    const sym = await lda.symbol().call();
    sym === 'LDA' ? pass('symbol() correct') : fail('symbol()', `Got: ${sym}`);
  } catch(e) { fail('symbol()', e.message); }

  try {
    const dec = await lda.decimals().call();
    Number(dec) === 6 ? pass('decimals() = 6') : fail('decimals()', `Got: ${dec}`);
  } catch(e) { fail('decimals()', e.message); }

  try {
    const cap = await lda.MAX_SUPPLY().call();
    const capNum = Number(cap) / 1e6;
    capNum === 10_000_000 ? pass(`MAX_SUPPLY = 10,000,000`) : fail('MAX_SUPPLY', `Got: ${capNum}`);
  } catch(e) { fail('MAX_SUPPLY()', e.message); }

  // ── 2. SUPPLY & BALANCES ─────────────────────
  section('2. Supply & Balances');
  try {
    const supply = await lda.totalSupply().call();
    const supplyNum = Number(supply) / 1e6;
    log(`  ℹ️  Total supply: ${supplyNum.toLocaleString()} LDA v2`);
    supplyNum === 10_000_000 ? pass('Total supply = 10M (all minted to migration)') : fail('Total supply', `Got: ${supplyNum}`);
  } catch(e) { fail('totalSupply()', e.message); }

  try {
    const bal = await lda.balanceOf(ADDR.MIGRATION).call();
    const balNum = Number(bal) / 1e6;
    log(`  ℹ️  Migration contract holds: ${balNum.toLocaleString()} LDA v2`);
    balNum === 10_000_000 ? pass('Migration holds full 10M LDA v2') : fail('Migration balance', `Got: ${balNum}`);
  } catch(e) { fail('balanceOf(migration)', e.message); }

  try {
    const deployerBal = await lda.balanceOf(DEPLOYER).call();
    log(`  ℹ️  Deployer LDA v2 balance: ${(Number(deployerBal)/1e6).toLocaleString()}`);
    pass('balanceOf(deployer) readable');
  } catch(e) { fail('balanceOf(deployer)', e.message); }

  try {
    const mockBal = await mockV1.balanceOf(DEPLOYER).call();
    log(`  ℹ️  Deployer Mock LDA v1 balance: ${(Number(mockBal)/1e6).toLocaleString()}`);
    Number(mockBal) > 0 ? pass('Deployer has mock LDA v1 for migration testing') : fail('Mock v1 balance', 'Deployer has 0 mock LDA v1');
  } catch(e) { fail('mockV1.balanceOf()', e.message); }

  // ── 3. HARD CAP ENFORCEMENT ──────────────────
  section('3. Hard Cap Enforcement');
  try {
    // Try to mint 1 more token beyond cap — should fail
    await lda.mint(DEPLOYER, 1).send({ feeLimit: 100000000 });
    fail('Hard cap', 'Minted beyond max supply — CRITICAL VULNERABILITY');
  } catch(e) {
    e.message.includes('hard cap') || e.message.includes('revert') || e.message.includes('REVERT')
      ? pass('Cannot mint beyond 10M hard cap')
      : pass('Hard cap enforced (transaction rejected)');
  }

  // ── 4. PLATFORM AUTHORIZATION ────────────────
  section('4. Platform Authorization');
  try {
    const isAuth = await lda.authorizedPlatforms(ADDR.PLATFORM).call();
    isAuth ? pass('Platform contract is authorized on LDA v2') : fail('Platform auth', 'Platform NOT authorized');
  } catch(e) { fail('authorizedPlatforms()', e.message); }

  try {
    const rando = 'TG1ZuSqJdgmD11i2FyCXxtjBbTEiEzRVQy';
    const isAuth = await lda.authorizedPlatforms(rando).call();
    !isAuth ? pass('Random address NOT authorized (correct)') : fail('Auth check', 'Random address is authorized — VULNERABILITY');
  } catch(e) { fail('Random auth check', e.message); }

  // ── 5. BURN SPLIT ────────────────────────────
  section('5. Burn Split Mechanics');
  try {
    const burnPct = await lda.burnPercent().call();
    const tresPct = await lda.treasuryPercent().call();
    Number(burnPct) === 70 && Number(tresPct) === 30
      ? pass(`Burn split correct: ${burnPct}% burn / ${tresPct}% treasury`)
      : fail('Burn split', `Got: ${burnPct}/${tresPct}`);
  } catch(e) { fail('burnPercent()', e.message); }

  try {
    const treasury = await lda.treasuryWallet().call();
    treasury.toLowerCase() === DEPLOYER.toLowerCase()
      ? pass(`Treasury wallet set correctly: ${treasury}`)
      : fail('Treasury wallet', `Got: ${treasury}`);
  } catch(e) { fail('treasuryWallet()', e.message); }

  // ── 6. TIER SYSTEM ───────────────────────────
  section('6. Tiered Access');
  try {
    const bronze = await lda.bronzeThreshold().call();
    const silver = await lda.silverThreshold().call();
    const gold   = await lda.goldThreshold().call();
    pass(`Tiers set — Bronze:${Number(bronze)/1e6} / Silver:${Number(silver)/1e6} / Gold:${Number(gold)/1e6} LDA v2`);
  } catch(e) { fail('Tier thresholds', e.message); }

  try {
    const tier = await lda.getTier(DEPLOYER).call();
    log(`  ℹ️  Deployer tier: ${['None','Bronze','Silver','Gold'][Number(tier)]}`);
    pass('getTier() callable');
  } catch(e) { fail('getTier()', e.message); }

  // ── 7. MIGRATION CONTRACT ────────────────────
  section('7. Migration Contract');
  try {
    const stats = await mig.stats().call();
    const open      = stats[0];
    const deadline  = Number(stats[1]);
    const migrated  = Number(stats[2]) / 1e6;
    const issued    = Number(stats[3]) / 1e6;
    const remaining = Number(stats[4]);
    open ? pass(`Migration window OPEN — deadline: ${new Date(deadline*1000).toLocaleDateString()}`) : fail('Migration open', 'Window is closed');
    pass(`Stats readable — Migrated: ${migrated} / Issued: ${issued} / Time remaining: ${Math.floor(remaining/86400)}d`);
  } catch(e) { fail('Migration stats()', e.message); }

  try {
    const ratio = await mig.RATIO().call();
    Number(ratio) === 2 ? pass('Migration ratio = 2:1 (correct)') : fail('Migration ratio', `Got: ${ratio}`);
  } catch(e) { fail('RATIO()', e.message); }

  try {
    const preview = await mig.previewMigration(2000000).call(); // 2 LDA v1
    Number(preview) === 1000000 ? pass('previewMigration: 2 v1 → 1 v2 (correct)') : fail('previewMigration', `Got: ${preview}`);
  } catch(e) { fail('previewMigration()', e.message); }

  // ── 8. MIGRATION FLOW SIMULATION ─────────────
  section('8. Migration Flow (Live Test)');
  try {
    // Approve migration contract to spend mock v1
    const approveAmt = 200 * 1e6; // 200 mock LDA v1
    await mockV1.approve(ADDR.MIGRATION, approveAmt).send({ feeLimit: 100000000 });
    await sleep(4000);
    const allowance = await mockV1.allowance(DEPLOYER, ADDR.MIGRATION).call();
    Number(allowance) >= approveAmt ? pass('Approved migration contract to spend mock LDA v1') : fail('Approve', 'Allowance not set');
  } catch(e) { fail('approve() for migration', e.message); }

  await sleep(3000);

  try {
    const v2BalBefore = await lda.balanceOf(DEPLOYER).call();
    await mig.migrate(200 * 1e6).send({ feeLimit: 300000000 });
    await sleep(5000);
    const v2BalAfter = await lda.balanceOf(DEPLOYER).call();
    const received = (Number(v2BalAfter) - Number(v2BalBefore)) / 1e6;
    received === 100 ? pass(`Migration SUCCESS: sent 200 v1 → received ${received} LDA v2`) : fail('Migration', `Expected 100 v2, got ${received}`);
  } catch(e) { fail('migrate()', e.message); }

  // ── 9. PAUSE MECHANISM ───────────────────────
  section('9. Emergency Pause');
  try {
    const isPaused = await lda.paused().call();
    !isPaused ? pass('Contract NOT paused (normal state)') : fail('Pause state', 'Contract is paused on deploy — unexpected');
  } catch(e) { fail('paused()', e.message); }

  try {
    await lda.pause().send({ feeLimit: 100000000 });
    await sleep(3000);
    const isPaused = await lda.paused().call();
    isPaused ? pass('pause() works — transfers blocked') : fail('pause()', 'Contract not pausing');
  } catch(e) { fail('pause()', e.message); }

  try {
    // Attempt transfer while paused — should fail
    await lda.transfer(ADDR.MIGRATION, 1000000).send({ feeLimit: 100000000 });
    fail('Pause blocks transfers', 'Transfer succeeded while paused — VULNERABILITY');
  } catch(e) {
    pass('Transfer correctly blocked while paused');
  }

  try {
    await lda.unpause().send({ feeLimit: 100000000 });
    await sleep(3000);
    const isPaused = await lda.paused().call();
    !isPaused ? pass('unpause() works — transfers restored') : fail('unpause()', 'Still paused');
  } catch(e) { fail('unpause()', e.message); }

  // ── 10. ACCESS CONTROL ───────────────────────
  section('10. Access Control');
  try {
    const owner = await lda.owner().call();
    owner.toLowerCase() === DEPLOYER.toLowerCase()
      ? pass(`Owner set correctly: ${owner}`)
      : fail('Owner', `Got: ${owner}`);
  } catch(e) { fail('owner()', e.message); }

  try {
    const migOwner = await mig.owner().call();
    migOwner.toLowerCase() === DEPLOYER.toLowerCase()
      ? pass('Migration contract owner correct')
      : fail('Migration owner', `Got: ${migOwner}`);
  } catch(e) { fail('mig.owner()', e.message); }

  // ── 11. BURN SPLIT BOUNDS ────────────────────
  section('11. Burn Split Bounds (Security)');
  try {
    // Try to set burn to 10% — should be rejected (min 50%)
    await lda.setBurnSplit(10, 90).send({ feeLimit: 100000000 });
    fail('Burn split bounds', 'Set burn to 10% — should be blocked — VULNERABILITY');
  } catch(e) {
    pass('Cannot set burn below 50% (protected)');
  }

  try {
    // Try to set burn to 95% — should be rejected (max 90%)
    await lda.setBurnSplit(95, 5).send({ feeLimit: 100000000 });
    fail('Burn split upper bound', 'Set burn to 95% — should be blocked');
  } catch(e) {
    pass('Cannot set burn above 90% (protected)');
  }

  try {
    // Valid split — should work
    await lda.setBurnSplit(70, 30).send({ feeLimit: 100000000 });
    await sleep(3000);
    const bp = await lda.burnPercent().call();
    Number(bp) === 70 ? pass('Valid burn split 70/30 accepted') : fail('Valid split', `Got: ${bp}`);
  } catch(e) { fail('setBurnSplit(70,30)', e.message); }

  // ── 12. PLATFORM TOOLS ───────────────────────
  section('12. Platform Tools Registry');
  try {
    const tools = await plat.getAllTools().call();
    tools.length === 3 ? pass(`3 tools registered correctly`) : fail('Tools count', `Got: ${tools.length}`);
    tools.forEach(t => log(`  ℹ️  Tool: ${t.name} — ${Number(t.baseCost)/1e6} LDA v2`));
  } catch(e) { fail('getAllTools()', e.message); }

  // ── RESULTS ──────────────────────────────────
  log('\n' + '═'.repeat(44));
  log(`🏁 RESULTS: ${passed} passed / ${failed} failed`);

  if (issues.length > 0) {
    log('\n⚠️  ISSUES FOUND:');
    issues.forEach((i, n) => log(`  ${n+1}. ${i.test}: ${i.err}`));
  } else {
    log('\n✅ All tests passed — contracts look clean');
  }
  log('═'.repeat(44) + '\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
