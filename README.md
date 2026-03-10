# AvalanchePredict

A privacy-preserving prediction market platform on Avalanche, powered by Fhenix Fully Homomorphic Encryption (FHE). Built entirely through vibecoding with [Matterhorn](https://matterhorn.dev).

**Live Demo:** https://frontend-lyart-seven-39.vercel.app

**GitHub:** https://github.com/matterhornso/Avalanchebuildgames

## What It Does

AvalanchePredict lets users browse prediction markets on real-world outcomes — crypto prices, DeFi milestones, regulatory events, and more — and place Yes/No bets using native AVAX. When a market resolves, winners claim payouts proportional to their stake in the winning pool.

What makes it different: bet amounts are encrypted on-chain using Fhenix CoFHE. No one — not other users, not the contract operator, not block explorers — can see how much anyone bet. Only participant counts are public. This prevents front-running, copycat betting, and social pressure that plague transparent prediction markets.

The app ships with 25 sample markets across 5 categories so you can explore the full experience without deploying anything.

## How It Was Built — Vibecoding with Matterhorn

This entire project — smart contracts, deploy scripts, tests, frontend, and deployment — was vibecoded from scratch using Matterhorn, an AI-powered IDE for blockchain developers.

Here's what that looked like in practice:

1. **Smart contract generation** — Started with a single prompt: "Create a simple prediction market platform on Avalanche with 10 sample markets." Matterhorn scaffolded a Foundry project, wrote the Solidity contract with market creation, binary betting, resolver-based settlement, and proportional payout math, then generated a deploy script and 7 passing tests — all in one shot.

2. **Frontend in one pass** — Asked for "a sleek front-end" and Matterhorn built a full React + Vite + TypeScript app with wallet connection, market browsing, category filtering, search, bet placement, payout claiming, and a dark glassmorphism Avalanche-themed design. Later upgraded to 25 markets across 5 categories with staggered animations and responsive grid layout.

3. **FHE privacy integration** — Adding Fhenix CoFHE encryption was a single prompt. Matterhorn wrote a new `PrivatePredictionMarket.sol` using `euint64` encrypted values, configured Foundry remappings for the CoFHE library, and updated the frontend with privacy indicators, encryption animations, and participant-count-only displays.

4. **Deployment** — Vercel deployment was handled through Matterhorn's built-in terminal integration. Local testing used Matterhorn's Anvil integration with automatic contract deployment.

No boilerplate was written by hand. No copy-pasting from tutorials. The entire development cycle — from empty folder to deployed app — happened through natural language conversation with Matterhorn.

## Architecture

```
├── src/
│   ├── PredictionMarket.sol          # Standard prediction market (Avalanche-ready)
│   └── PrivatePredictionMarket.sol   # FHE-encrypted bets via Fhenix CoFHE
├── script/
│   └── Deploy.s.sol                  # Foundry deploy script (10 on-chain markets)
├── test/
│   └── PredictionMarket.t.sol        # 7 Foundry tests
└── frontend/                         # React + Vite + TypeScript
    └── src/
        ├── App.tsx                   # Main app with 25 demo markets
        ├── contract.ts               # ABI and contract config
        └── index.css                 # Glassmorphism theme
```

### Smart Contracts

**PredictionMarket.sol** — The core contract deployed on Avalanche. Supports:
- Market creation with custom questions, options, deadlines, and resolvers
- Binary Yes/No betting with native AVAX
- Resolver-based market settlement
- Proportional payout distribution to winners
- Full revert protection (expired markets, double claims, unresolved markets)

**PrivatePredictionMarket.sol** — The privacy-enhanced version using Fhenix CoFHE:
- Bet amounts stored as `euint64` encrypted values
- `FHE.add()` for encrypted pool accumulation without revealing individual bets
- `FHE.select()` for constant-time payout branching (no timing side channels)
- `FHE.allowThis()` / `FHE.allowSender()` for encrypted state access control
- Only participant counts are exposed publicly

### Frontend

- 25 sample markets across 5 categories: Crypto, DeFi, Regulation, Avalanche, Tech
- Category tab filtering and search
- Glassmorphism card design with ambient glow effects and staggered fade-in animations
- Click-to-expand bet panels with Yes/No buttons
- FHE privacy badges, encryption indicators, and participant-count-only pool displays
- Wallet connection with account display and network detection
- Demo mode that works without any contract deployment
- Fully responsive layout

## Privacy Design (Fhenix FHE)

Traditional prediction markets expose all bet amounts on-chain. This creates problems:
- **Front-running** — MEV bots can see large bets and trade ahead
- **Copycat betting** — Users mimic whale positions instead of forming independent views
- **Social pressure** — Public bets discourage contrarian positions

AvalanchePredict solves this with Fhenix CoFHE (Cooperative Fully Homomorphic Encryption). Individual bet amounts are encrypted before being stored on-chain. The contract can still compute aggregate pool totals and payouts using FHE arithmetic — without ever decrypting individual bets.

> **Network note:** CoFHE currently supports Ethereum Sepolia, Arbitrum Sepolia, and Base Sepolia. The standard `PredictionMarket.sol` works on Avalanche today. When Fhenix adds Avalanche support, the private contract can be deployed directly.

## Quick Start

### Build & Test

```bash
forge build
forge test
```

### Run Locally

```bash
# Terminal 1: Start local Avalanche node
anvil

# Terminal 2: Deploy contract with sample markets
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3: Start frontend dev server
cd frontend && npm install && npm run dev
```

Open the URL printed by Vite (e.g. `http://localhost:5173`). Connect a wallet to `localhost:8545` (chain ID 31337).

The frontend also runs in **demo mode** with all 25 sample markets if no contract is deployed — just start the frontend and go.

### FHE Testing (Hardhat)

```bash
npm install
npx hardhat test
```

## Tech Stack

- **Contracts:** Solidity 0.8.25, Foundry, Hardhat
- **Privacy:** Fhenix CoFHE (`@fhenixprotocol/cofhe-contracts`)
- **Frontend:** React 18, Vite, TypeScript, ethers.js v6
- **Chain:** Avalanche C-Chain
- **Deployment:** Vercel (frontend), Foundry scripts (contracts)
- **Development:** Vibecoded with [Matterhorn](https://matterhorn.dev)

## License

MIT
