/**
 * TronBox Configuration
 * Lion X AI Platform — LDA v2 Deployment
 *
 * Networks:
 *   shasta   → Tron testnet (test here first)
 *   mainnet  → Tron mainnet (only after testnet verified)
 *
 * Usage:
 *   tronbox migrate --network shasta
 *   tronbox migrate --network mainnet
 */

const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY || '';
const TREASURY    = process.env.TREASURY_WALLET   || '';

module.exports = {
  networks: {

    // ── Shasta Testnet ──
    shasta: {
      privateKey:   PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit:     1_000_000_000,
      fullHost:     'https://api.shasta.trongrid.io',
      network_id:   '2',
    },

    // ── Nile Testnet (alternative) ──
    nile: {
      privateKey:   PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit:     1_000_000_000,
      fullHost:     'https://nile.trongrid.io',
      network_id:   '3',
    },

    // ── Mainnet ── (DO NOT DEPLOY UNTIL TESTNET VERIFIED)
    mainnet: {
      privateKey:   PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit:     1_500_000_000,
      fullHost:     'https://api.trongrid.io',
      network_id:   '1',
    },
  },

  // Compiler settings
  compilers: {
    solc: {
      version: '0.8.19',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
