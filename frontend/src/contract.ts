export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // default anvil deploy address

export const ABI = [
  "function marketCount() view returns (uint256)",
  "function getMarket(uint256) view returns (tuple(string question, uint256 deadline, address resolver, uint256 yesPool, uint256 noPool, bool resolved, uint8 winningOutcome))",
  "function getUserBet(uint256, address) view returns (tuple(uint256 yesAmount, uint256 noAmount, bool claimed))",
  "function placeBet(uint256 marketId, uint8 outcome) payable",
  "function claimPayout(uint256 marketId)",
  "event BetPlaced(uint256 indexed id, address indexed user, uint8 outcome, uint256 amount)",
  "event MarketResolved(uint256 indexed id, uint8 outcome)",
  "event PayoutClaimed(uint256 indexed id, address indexed user, uint256 amount)",
] as const;
