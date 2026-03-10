# AvalanchePredict

A prediction market platform on Avalanche with privacy-preserving bets powered by Fhenix FHE (Fully Homomorphic Encryption).

## Overview

Users can browse markets, place Yes/No bets on real-world outcomes, and claim payouts when markets resolve. Bet amounts are encrypted on-chain using Fhenix CoFHE — no one can see how much you bet, not even the contract operator.

## Architecture

- **`src/PredictionMarket.sol`** — Standard prediction market contract (Avalanche-compatible)
- **`src/PrivatePredictionMarket.sol`** — FHE-enabled contract using Fhenix CoFHE with encrypted `euint64` bet amounts
- **`script/Deploy.s.sol`** — Deploy script that creates 10 sample markets
- **`test/PredictionMarket.t.sol`** — Foundry tests (7 tests)
- **`frontend/`** — React + Vite + TypeScript frontend with 25 demo markets

## Privacy (Fhenix FHE)

Individual bet amounts are stored as `euint64` encrypted values using Fhenix CoFHE. Only participant counts are public. The contract uses:

- `FHE.asEuint64()` for encrypting amounts on-chain
- `FHE.add()` for encrypted pool accumulation
- `FHE.select()` for constant-time payout branching
- `FHE.allowThis()` / `FHE.allowSender()` for encrypted state ACL

> **Note:** CoFHE currently supports Ethereum Sepolia, Arbitrum Sepolia, and Base Sepolia. The standard `PredictionMarket.sol` works on Avalanche today.

## Quick Start

### Build & Test

```bash
forge build
forge test
```

### Run Locally

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy with sample markets
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3: Start frontend
cd frontend && npm install && npm run dev
```

Open the URL printed by Vite (e.g. `http://localhost:5173`). Connect a wallet to `localhost:8545` (chain ID 31337).

The frontend also runs in demo mode with 25 sample markets if no contract is deployed.

### FHE Testing (Hardhat)

```bash
npm install
npx hardhat test
```

## Tech Stack

- Solidity 0.8.25, Foundry, Hardhat
- Fhenix CoFHE (`@fhenixprotocol/cofhe-contracts`)
- React, Vite, TypeScript, ethers.js
- Avalanche C-Chain
