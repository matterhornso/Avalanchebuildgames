// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract PredictionMarket {
    error MarketNotActive();
    error MarketAlreadyResolved();
    error InvalidOutcome();
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
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        Outcome winningOutcome;
    }

    struct Bet {
        uint256 yesAmount;
        uint256 noAmount;
        bool claimed;
    }

    address public owner;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bet)) public bets;

    event MarketCreated(uint256 indexed id, string question, uint256 deadline);
    event BetPlaced(uint256 indexed id, address indexed user, Outcome outcome, uint256 amount);
    event MarketResolved(uint256 indexed id, Outcome outcome);
    event PayoutClaimed(uint256 indexed id, address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createMarket(
        string calldata question,
        uint256 deadline,
        address resolver
    ) external onlyOwner returns (uint256 id) {
        require(deadline > block.timestamp, "Deadline in past");
        require(resolver != address(0), "Zero resolver");

        id = marketCount++;
        markets[id] = Market({
            question: question,
            deadline: deadline,
            resolver: resolver,
            yesPool: 0,
            noPool: 0,
            resolved: false,
            winningOutcome: Outcome.Yes
        });

        emit MarketCreated(id, question, deadline);
    }

    function placeBet(uint256 marketId, Outcome outcome) external payable {
        if (msg.value == 0) revert InsufficientAmount();
        Market storage m = markets[marketId];
        if (m.resolved || block.timestamp >= m.deadline) revert MarketNotActive();

        Bet storage b = bets[marketId][msg.sender];

        if (outcome == Outcome.Yes) {
            m.yesPool += msg.value;
            b.yesAmount += msg.value;
        } else {
            m.noPool += msg.value;
            b.noAmount += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, outcome, msg.value);
    }

    function resolveMarket(uint256 marketId, Outcome outcome) external {
        Market storage m = markets[marketId];
        if (msg.sender != m.resolver) revert NotResolver();
        if (m.resolved) revert MarketAlreadyResolved();

        m.resolved = true;
        m.winningOutcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    function claimPayout(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (!m.resolved) revert MarketNotActive();

        Bet storage b = bets[marketId][msg.sender];
        if (b.claimed) revert AlreadyClaimed();

        uint256 winningAmount = m.winningOutcome == Outcome.Yes ? b.yesAmount : b.noAmount;
        if (winningAmount == 0) revert NothingToClaim();

        uint256 winningPool = m.winningOutcome == Outcome.Yes ? m.yesPool : m.noPool;
        uint256 totalPool = m.yesPool + m.noPool;
        uint256 payout = (winningAmount * totalPool) / winningPool;

        b.claimed = true;

        (bool ok, ) = msg.sender.call{value: payout}("");
        if (!ok) revert TransferFailed();

        emit PayoutClaimed(marketId, msg.sender, payout);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getUserBet(uint256 marketId, address user) external view returns (Bet memory) {
        return bets[marketId][user];
    }
}
