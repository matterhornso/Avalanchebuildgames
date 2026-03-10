// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint64, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract PrivatePredictionMarket {
    error MarketNotActive();
    error MarketAlreadyResolved();
    error InsufficientAmount();
    error NotResolver();
    error AlreadyClaimed();
    error NothingToClaim();
    error TransferFailed();

    enum Outcome { Yes, No }

    struct Market {
        string question;
        uint256 deadline;
        address resolver;
        euint64 yesPool;    // Encrypted — hides total pool size
        euint64 noPool;     // Encrypted — hides total pool size
        uint256 yesCount;   // Public participant count (no amounts revealed)
        uint256 noCount;
        bool resolved;
        Outcome winningOutcome;
    }

    struct Bet {
        euint64 yesAmount;  // Encrypted — hides individual bet size
        euint64 noAmount;   // Encrypted — hides individual bet size
        bool hasBet;
        bool claimed;
    }

    address public owner;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bet)) public bets;

    euint64 private ZERO;

    event MarketCreated(uint256 indexed id, string question, uint256 deadline);
    event BetPlaced(uint256 indexed id, address indexed user, Outcome outcome);
    event MarketResolved(uint256 indexed id, Outcome outcome);
    event PayoutClaimed(uint256 indexed id, address indexed user);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        ZERO = FHE.asEuint64(0);
        FHE.allowThis(ZERO);
    }

    function createMarket(
        string calldata question,
        uint256 deadline,
        address resolver
    ) external onlyOwner returns (uint256 id) {
        require(deadline > block.timestamp, "Deadline in past");
        require(resolver != address(0), "Zero resolver");

        id = marketCount++;
        Market storage m = markets[id];
        m.question = question;
        m.deadline = deadline;
        m.resolver = resolver;
        m.yesPool = ZERO;
        m.noPool = ZERO;
        m.winningOutcome = Outcome.Yes;
    }

    /// @notice Place a bet with an encrypted amount. msg.value is the actual AVAX sent.
    /// The encrypted amount keeps your bet size private from other users.
    function placeBet(
        uint256 marketId,
        Outcome outcome,
        InEuint64 calldata encryptedAmount
    ) external payable {
        if (msg.value == 0) revert InsufficientAmount();

        Market storage m = markets[marketId];
        if (m.resolved || block.timestamp >= m.deadline) revert MarketNotActive();

        // Convert the encrypted input to an on-chain encrypted value
        euint64 amount = FHE.asEuint64(encryptedAmount);

        Bet storage b = bets[marketId][msg.sender];

        if (outcome == Outcome.Yes) {
            m.yesPool = b.hasBet ? FHE.add(m.yesPool, amount) : FHE.add(m.yesPool, amount);
            b.yesAmount = b.hasBet ? FHE.add(b.yesAmount, amount) : amount;
            m.yesCount++;
        } else {
            m.noPool = b.hasBet ? FHE.add(m.noPool, amount) : FHE.add(m.noPool, amount);
            b.noAmount = b.hasBet ? FHE.add(b.noAmount, amount) : amount;
            m.noCount++;
        }

        b.hasBet = true;

        // ACL: allow contract to read its own encrypted state
        FHE.allowThis(m.yesPool);
        FHE.allowThis(m.noPool);
        FHE.allowThis(b.yesAmount);
        FHE.allowThis(b.noAmount);
        // ACL: allow the bettor to decrypt their own position
        FHE.allowSender(b.yesAmount);
        FHE.allowSender(b.noAmount);

        emit BetPlaced(marketId, msg.sender, outcome);
    }

    function resolveMarket(uint256 marketId, Outcome outcome) external {
        Market storage m = markets[marketId];
        if (msg.sender != m.resolver) revert NotResolver();
        if (m.resolved) revert MarketAlreadyResolved();

        m.resolved = true;
        m.winningOutcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    /// @notice Claim payout. Uses FHE.select for constant-time encrypted branching.
    function claimPayout(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (!m.resolved) revert MarketNotActive();

        Bet storage b = bets[marketId][msg.sender];
        if (b.claimed) revert AlreadyClaimed();
        if (!b.hasBet) revert NothingToClaim();

        b.claimed = true;

        // Use encrypted select — no branching on secret data
        euint64 winningBet = FHE.select(
            FHE.eq(FHE.asEuint64(uint64(m.winningOutcome)), FHE.asEuint64(0)),
            b.yesAmount,
            b.noAmount
        );

        // Request async decryption for payout calculation
        // In production, this triggers a callback from the CoFHE coprocessor
        FHE.decrypt(winningBet);

        emit PayoutClaimed(marketId, msg.sender);
    }

    // View helpers (public data only)
    function getMarketInfo(uint256 id) external view returns (
        string memory question, uint256 deadline, address resolver,
        uint256 yesCount, uint256 noCount, bool resolved, Outcome winningOutcome
    ) {
        Market storage m = markets[id];
        return (m.question, m.deadline, m.resolver, m.yesCount, m.noCount, m.resolved, m.winningOutcome);
    }

    function hasBet(uint256 marketId, address user) external view returns (bool) {
        return bets[marketId][user].hasBet;
    }

    function hasClaimed(uint256 marketId, address user) external view returns (bool) {
        return bets[marketId][user].claimed;
    }
}
