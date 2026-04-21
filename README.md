# 🦁 Lion X AI Platform

> Token-gated AI tools for Tron. Burn LDA v2 to access wallet analysis, contract audits, and market intelligence.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-lionx--mockup.vercel.app-14b8a6?style=flat-square)](https://lionx-mockup.vercel.app)
[![Built on Tron](https://img.shields.io/badge/Built%20on-Tron-red?style=flat-square)](https://tron.network)
[![Token](https://img.shields.io/badge/Token-LDA%20v2-f5a623?style=flat-square)](https://tronscan.org)

---

## Overview

Lion X is a token-gated AI platform built on Tron. Users burn **LDA v2** tokens to access AI-powered crypto tools — wallet analyzers, contract auditors, and market intelligence.

Every interaction burns tokens → reduces supply → increases scarcity.

---

## Project Structure

```
lionx-platform/
├── frontend/          # Next.js web app
│   ├── pages/         # App pages
│   ├── components/    # UI components
│   └── styles/        # Global styles
├── contracts/         # TRC-20 smart contracts (Solidity)
│   ├── LDAv2.sol      # Main token contract
│   └── Migration.sol  # LDA → LDA v2 migration
├── backend/           # API / middleware
│   ├── api/           # Serverless functions
│   └── lib/           # Tron utilities
├── scripts/           # Deployment scripts
└── docs/              # Architecture docs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + Tailwind CSS |
| Wallet | TronWeb.js + TronLink |
| Smart Contracts | Solidity (TRC-20) |
| Backend | Vercel Serverless |
| AI | OpenRouter API |
| Blockchain Data | Tronscan API |
| Hosting | Vercel |

---

## Token Architecture

### LDA v2 (Platform Token)
- **Contract:** TBD (deploying to Tron mainnet)
- **Max Supply:** 10,000,000 LDA v2
- **Burn:** 70% of every transaction burned permanently
- **Treasury:** 30% to platform development wallet
- **Migration:** 2 old LDA → 1 LDA v2

### MANES (Community Token)
- **Contract:** `TXwXmQWu8e8zzfJSy5ptGRzi7fdgwYJz6d`
- **Role:** Merch store, community perks, NFT utility
- **Holders:** 270

---

## AI Tools

| Tool | Cost | Description |
|------|------|-------------|
| Wallet Analyzer | 50 LDA v2 | Portfolio breakdown, trading patterns, risk score |
| Contract Auditor | 100 LDA v2 | Honeypot detection, rug scan, ownership analysis |
| Market Intelligence | 25 LDA v2 | Sentiment, holder trends, AI commentary |

---

## Roadmap

- [x] **Phase 1** — LDA v2 contract + migration portal
- [ ] **Phase 2** — Platform beta + AI tools live
- [ ] **Phase 3** — Public launch + Builder SDK
- [ ] **Phase 4** — AI Agent Marketplace

---

## Community

- 🌐 Website: [lionxeco.net](https://lionxeco.net)
- 💬 Telegram: [t.me/Lionxone](https://t.me/Lionxone)
- 🐦 Twitter: [@LionX05494692](https://twitter.com/LionX05494692)
- 🔍 Tronscan: [LDA Token](https://tronscan.org/#/token20/TNP1D18nJCqQHhv4i38qiNtUUuL5VyNoC1)

---

## Development

```bash
# Clone
git clone https://github.com/vanta722/lionx-platform.git
cd lionx-platform

# Frontend
cd frontend
npm install
npm run dev

# Open http://localhost:3000
```

---

© 2026 Lion X Ecosystem. Built on Tron.
