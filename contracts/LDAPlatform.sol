// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * LDA Platform Contract
 *
 * The middleware between users and the AI backend.
 * Handles:
 *   - Tool registration & pricing
 *   - burnFrom() calls on LDA v2
 *   - Tier-based discounts
 *   - Usage tracking per wallet
 *   - Query nonce (prevents replay)
 */

interface ILDAv2 {
    enum Tier { None, Bronze, Silver, Gold }
    function burnFrom(address account, uint256 amount, bytes32 toolId) external;
    function getTier(address account) external view returns (Tier);
    function balanceOf(address account) external view returns (uint256);
}

contract LDAPlatform {

    address public owner;
    ILDAv2  public ldaToken;

    // ── Tool Registry ──
    struct Tool {
        bytes32 id;
        string  name;
        uint256 baseCost;    // LDA v2 with 6 decimals
        bool    active;
        uint256 totalQueries;
    }

    mapping(bytes32 => Tool) public tools;
    bytes32[] public toolIds;

    // ── Tier Discounts ──
    // Discount in basis points (100 = 1%)
    uint256 public bronzeDiscount = 500;  // 5%
    uint256 public silverDiscount = 1000; // 10%
    uint256 public goldDiscount   = 2000; // 20%

    // ── Usage Tracking ──
    mapping(address => uint256) public queriesRun;
    mapping(address => uint256) public totalBurnedBy;

    // ── Query Nonce ── (prevents replay attacks)
    mapping(address => uint256) public nonce;

    // ── Subscription ──
    struct Subscription {
        uint256 expiresAt;
        uint256 dailyQueries;
        uint256 queriesUsedToday;
        uint256 dayStart;
    }
    mapping(address => Subscription) public subscriptions;
    uint256 public monthlySubCost = 500 * 10**6; // 500 LDA v2/month

    // ── Events ──
    event QueryExecuted(
        address indexed user,
        bytes32 indexed toolId,
        uint256 cost,
        uint256 actualBurn,
        uint256 nonce
    );
    event ToolRegistered(bytes32 indexed toolId, string name, uint256 cost);
    event ToolUpdated(bytes32 indexed toolId, uint256 newCost, bool active);
    event SubscriptionPurchased(address indexed user, uint256 expiresAt);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _ldaToken) {
        owner    = msg.sender;
        ldaToken = ILDAv2(_ldaToken);

        // Register default tools
        _registerTool(keccak256("WALLET_ANALYZER"),   "Wallet Analyzer",   50  * 10**6);
        _registerTool(keccak256("CONTRACT_AUDITOR"),  "Contract Auditor",  100 * 10**6);
        _registerTool(keccak256("MARKET_INTEL"),      "Market Intelligence", 25 * 10**6);
    }

    /**
     * @dev Execute an AI query — burns LDA v2 and emits event for backend.
     * Backend listens for QueryExecuted events to serve AI responses.
     *
     * @param toolId   Registered tool identifier
     * @param queryRef Off-chain query reference hash (for backend matching)
     */
    function executeQuery(bytes32 toolId, bytes32 queryRef) external {
        Tool storage tool = tools[toolId];
        require(tool.active, "Tool not active");

        uint256 cost = getDiscountedCost(msg.sender, toolId);

        // Check subscription — subscribers get daily allowance
        if (_hasActiveSubscription(msg.sender)) {
            Subscription storage sub = subscriptions[msg.sender];
            // Reset daily counter if new day
            if (block.timestamp >= sub.dayStart + 1 days) {
                sub.queriesUsedToday = 0;
                sub.dayStart         = block.timestamp;
            }
            if (sub.queriesUsedToday < sub.dailyQueries) {
                sub.queriesUsedToday++;
                // Subscribers pay 50% of normal cost
                cost = cost / 2;
            }
        }

        uint256 userNonce = nonce[msg.sender]++;

        // Burn — requires prior approval from user
        ldaToken.burnFrom(msg.sender, cost, toolId);

        // Track usage
        queriesRun[msg.sender]    += 1;
        totalBurnedBy[msg.sender] += cost;
        tool.totalQueries         += 1;

        emit QueryExecuted(msg.sender, toolId, cost, (cost * 70) / 100, userNonce);
    }

    /**
     * @dev Purchase a monthly subscription.
     * Cost: 500 LDA v2/month. Gives 50% discount + 100 queries/day.
     */
    function purchaseSubscription() external {
        ldaToken.burnFrom(msg.sender, monthlySubCost, keccak256("SUBSCRIPTION"));

        Subscription storage sub = subscriptions[msg.sender];
        uint256 start = sub.expiresAt > block.timestamp ? sub.expiresAt : block.timestamp;
        sub.expiresAt      = start + 30 days;
        sub.dailyQueries   = 100;
        sub.queriesUsedToday = 0;
        sub.dayStart       = block.timestamp;

        emit SubscriptionPurchased(msg.sender, sub.expiresAt);
    }

    // ── View Helpers ──

    function getDiscountedCost(address user, bytes32 toolId) public view returns (uint256) {
        uint256 base = tools[toolId].baseCost;
        ILDAv2.Tier tier = ldaToken.getTier(user);

        uint256 discountBps;
        if      (tier == ILDAv2.Tier.Gold)   discountBps = goldDiscount;
        else if (tier == ILDAv2.Tier.Silver)  discountBps = silverDiscount;
        else if (tier == ILDAv2.Tier.Bronze)  discountBps = bronzeDiscount;

        return base - (base * discountBps / 10000);
    }

    function getAllTools() external view returns (Tool[] memory) {
        Tool[] memory result = new Tool[](toolIds.length);
        for (uint256 i = 0; i < toolIds.length; i++) {
            result[i] = tools[toolIds[i]];
        }
        return result;
    }

    function getUserStats(address user) external view returns (
        uint256 queries,
        uint256 burned,
        uint256 userNonce,
        ILDAv2.Tier tier,
        bool    hasSubscription,
        uint256 subExpiry
    ) {
        return (
            queriesRun[user],
            totalBurnedBy[user],
            nonce[user],
            ldaToken.getTier(user),
            _hasActiveSubscription(user),
            subscriptions[user].expiresAt
        );
    }

    function _hasActiveSubscription(address user) internal view returns (bool) {
        return subscriptions[user].expiresAt > block.timestamp;
    }

    // ── Admin ──

    function registerTool(bytes32 toolId, string calldata name_, uint256 cost) external onlyOwner {
        _registerTool(toolId, name_, cost);
    }

    function _registerTool(bytes32 toolId, string memory name_, uint256 cost) internal {
        require(!tools[toolId].active, "Tool exists");
        tools[toolId] = Tool({ id: toolId, name: name_, baseCost: cost, active: true, totalQueries: 0 });
        toolIds.push(toolId);
        emit ToolRegistered(toolId, name_, cost);
    }

    function updateTool(bytes32 toolId, uint256 newCost, bool active) external onlyOwner {
        tools[toolId].baseCost = newCost;
        tools[toolId].active   = active;
        emit ToolUpdated(toolId, newCost, active);
    }

    function setDiscounts(uint256 bronze, uint256 silver, uint256 gold) external onlyOwner {
        require(bronze < silver && silver < gold, "Invalid discounts");
        require(gold <= 5000, "Max 50% discount");
        bronzeDiscount = bronze;
        silverDiscount = silver;
        goldDiscount   = gold;
    }

    function setSubCost(uint256 cost) external onlyOwner {
        monthlySubCost = cost;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
