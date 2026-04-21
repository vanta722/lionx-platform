/**
 * LDA v2 Test Suite
 * Run: tronbox test --network shasta
 */

const LDAv2        = artifacts.require('LDAv2');
const LDAMigration = artifacts.require('LDAMigration');
const LDAPlatform  = artifacts.require('LDAPlatform');

contract('LDAv2', accounts => {
  const [owner, user1, user2, treasury, platform] = accounts;
  let lda, migration, platformContract;

  before(async () => {
    lda               = await LDAv2.new(treasury, { from: owner });
    platformContract  = await LDAPlatform.new(lda.address, { from: owner });
    await lda.setAuthorizedPlatform(platformContract.address, true, { from: owner });
  });

  // ── Supply ──
  describe('Supply & Hard Cap', () => {
    it('should have correct name and symbol', async () => {
      assert.equal(await lda.name(), 'Lion Digital Alliance V2');
      assert.equal(await lda.symbol(), 'LDA');
    });

    it('should have 10M hard cap', async () => {
      const cap = await lda.MAX_SUPPLY();
      assert.equal(cap.toString(), '10000000000000');
    });

    it('should mint up to hard cap', async () => {
      await lda.mint(user1, '1000000000', { from: owner }); // 1000 LDA v2
      const bal = await lda.balanceOf(user1);
      assert.equal(bal.toString(), '1000000000');
    });

    it('should reject mint beyond hard cap', async () => {
      try {
        await lda.mint(user1, '10000000000001', { from: owner });
        assert.fail('Should have reverted');
      } catch (e) {
        assert(e.message.includes('hard cap'));
      }
    });
  });

  // ── Burn ──
  describe('Burn Mechanics', () => {
    it('should burn with 70/30 split', async () => {
      const balBefore    = await lda.balanceOf(user1);
      const supplyBefore = await lda.totalSupply();
      const burnAmt      = 100_000_000; // 100 LDA v2

      await lda.burn(burnAmt, { from: user1 });

      const burnedAmount   = Math.floor(burnAmt * 0.7);
      const treasuryAmount = burnAmt - burnedAmount;

      const balAfter       = await lda.balanceOf(user1);
      const supplyAfter    = await lda.totalSupply();
      const treasuryBal    = await lda.balanceOf(treasury);

      assert.equal(
        balAfter.toString(),
        (BigInt(balBefore) - BigInt(burnAmt)).toString(),
        'User balance should decrease by full amount'
      );
      assert.equal(
        supplyAfter.toString(),
        (BigInt(supplyBefore) - BigInt(burnedAmount)).toString(),
        'Supply should decrease by 70%'
      );
      assert.equal(treasuryBal.toString(), treasuryAmount.toString(), 'Treasury should receive 30%');
    });
  });

  // ── Tiers ──
  describe('Tiered Access', () => {
    it('should return None for low balance', async () => {
      const tier = await lda.getTier(user2);
      assert.equal(tier.toString(), '0'); // None
    });

    it('should return Bronze for 500+ LDA v2', async () => {
      await lda.mint(user2, '500000000', { from: owner }); // 500 LDA v2
      const tier = await lda.getTier(user2);
      assert.equal(tier.toString(), '1'); // Bronze
    });

    it('should return Silver for 2000+ LDA v2', async () => {
      await lda.mint(user2, '1500000000', { from: owner }); // +1500 = 2000 total
      const tier = await lda.getTier(user2);
      assert.equal(tier.toString(), '2'); // Silver
    });

    it('should return Gold for 10000+ LDA v2', async () => {
      await lda.mint(user2, '8000000000', { from: owner }); // +8000 = 10000 total
      const tier = await lda.getTier(user2);
      assert.equal(tier.toString(), '3'); // Gold
    });
  });

  // ── Platform Authorization ──
  describe('Platform Authorization', () => {
    it('should authorize platform', async () => {
      assert.equal(await lda.authorizedPlatforms(platformContract.address), true);
    });

    it('should reject burnFrom from unauthorized address', async () => {
      await lda.mint(user1, '100000000', { from: owner });
      await lda.approve(user2, '100000000', { from: user1 });
      try {
        await lda.burnFrom(user1, '100000000', '0x0', { from: user2 });
        assert.fail('Should have reverted');
      } catch (e) {
        assert(e.message.includes('authorized'));
      }
    });
  });

  // ── Pause ──
  describe('Emergency Pause', () => {
    it('should pause transfers', async () => {
      await lda.pause({ from: owner });
      try {
        await lda.transfer(user2, '1000000', { from: user1 });
        assert.fail('Should have reverted');
      } catch (e) {
        assert(e.message.includes('paused'));
      }
      await lda.unpause({ from: owner });
    });
  });

  // ── Voting ──
  describe('Snapshot Voting', () => {
    it('should create snapshot', async () => {
      const tx = await lda.createSnapshot('Test: Should we add ETH bridge?', { from: owner });
      assert.equal(await lda.snapshotCount(), 1);
    });

    it('should allow voting', async () => {
      await lda.vote(1, true, { from: user1 });
      const results = await lda.getVoteResults(1);
      assert(results.forVotes > 0, 'Should have votes for');
    });

    it('should prevent double voting', async () => {
      try {
        await lda.vote(1, true, { from: user1 });
        assert.fail('Should have reverted');
      } catch (e) {
        assert(e.message.includes('already voted'));
      }
    });
  });
});
