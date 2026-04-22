// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * LDA Platform Contract — v1 Token Compatible
 *
 * Works with the existing LDA v1 TRC-20 token (no new token required).
 *
 * Query flow:
 *   1. User approves this contract to spend their LDA
 *   2. User calls executeQuery(toolId, queryRef)
 *   3. Contract pulls tokens via transferFrom()
 *   4. 70% sent to burnWallet (locked/dead address — removed from circulation)
 *   5. 30% sent to treasury (platform revenue)
 *   6. QueryExecuted event emitted → AI backend serves result
 *
 * Tier system based on LDA v1 balance held:
 *   Bronze:  500+  LDA
 *   Silver:  2,000+ LDA
 *   Gold:    10,000+ LDA
 */

interface ITRC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract LDAPlatform {

    address public owner;
    ITRC20  public ldaToken;       // LDA v1 token
    address public treasury;       // receives 30% of every query
    address public burnWallet;     // receives 70% — locked/provably dead address

    // ── Token decimals (LDA v1 uses 6 decimals) ──
    uint256 public constant DECIMALS = 6;

    // ── Burn / Treasury Split ──
    uint256 public burnPercent     = 70;
    uint256 public treasuryPercent = 30;

    // ── Tier Thresholds (LDA v1 balance) ──
    uint256 public bronzeThreshold = 500   * 10**DECIMALS;
    uint256 public silverThreshold = 2_000 * 10**DECIMALS;
    uint256 public goldThreshold   = 10_000 * 10**DECIMALS;

    // ── Tier Discounts (basis points — 100 = 1%) ──
    uint256 public bronzeDiscount = 500;   // 5%
    uint256 public silverDiscount = 1000;  // 10%
    uint256 public goldDiscount   = 2000;  // 20%

    // ── Tool Registry ──
    struct Tool {
        bytes32 id;
        string  name;
        uint256 baseCost;
        bool    active;
        uint256 totalQueries;
    }
    mapping(bytes32 => Tool) public tools;
    bytes32[] public toolIds;

    // ── Usage Tracking ──
    mapping(address => uint256) public queriesRun;
    mapping(address => uint256) public totalSpentBy;
    mapping(address => uint256) public nonce;

    // ── Subscription ──
    struct Subscription {
        uint256 expiresAt;
        uint256 dailyQueries;
        uint256 queriesUsedToday;
        uint256 dayStart;
    }
    mapping(address => Subscription) public subscriptions;
    uint256 public monthlySubCost = 500 * 10**DECIMALS;

    // ── Replay Protection ──
    mapping(bytes32 => bool) public usedRefs;  // queryRef → consumed

    // ── Pause ──
    bool public paused;

    // ── FIX-3: Two-step ownership ──
    address public pendingOwner;

    // ── FIX-8: Treasury timelock ──
    address public pendingTreasury;
    uint256 public treasuryChangeAfter; // timestamp after which pendingTreasury can be applied
    uint256 public constant TREASURY_TIMELOCK = 48 hours;

    // ── Events ──
    event QueryExecuted(
        address indexed user,
        bytes32 indexed toolId,
        uint256 cost,
        uint256 burnAmount,
        uint256 treasuryAmount,
        uint256 queryNonce
    );
    event ToolRegistered(bytes32 indexed toolId, string name, uint256 cost);
    event ToolUpdated(bytes32 indexed toolId, uint256 newCost, bool active);
    event SubscriptionPurchased(address indexed user, uint256 expiresAt);
    event BurnSplitUpdated(uint256 burnPct, uint256 treasuryPct);
    // FIX-3 + FIX-9: ownership events
    event OwnershipTransferProposed(address indexed current, address indexed proposed);
    event OwnershipTransferred(address indexed previous, address indexed newOwner);
    // FIX-8: treasury timelock events
    event TreasuryChangeProposed(address indexed proposed, uint256 effectiveAfter);
    event TreasuryChanged(address indexed previous, address indexed newTreasury);

    modifier onlyOwner()    { require(msg.sender == owner, "Not owner"); _; }
    modifier whenNotPaused(){ require(!paused, "Platform paused"); _; }

    constructor(
        address _ldaToken,
        address _treasury,
        address _burnWallet
    ) {
        require(_ldaToken   != address(0), "Zero token");
        require(_treasury   != address(0), "Zero treasury");
        require(_burnWallet != address(0), "Zero burn wallet");

        owner      = msg.sender;
        ldaToken   = ITRC20(_ldaToken);
        treasury   = _treasury;
        burnWallet = _burnWallet;

        // Register launch tools
        _registerTool(keccak256("WALLET_ANALYZER"),  "Wallet Analyzer",     50  * 10**DECIMALS);
        _registerTool(keccak256("CONTRACT_AUDITOR"), "Contract Auditor",    100 * 10**DECIMALS);
        _registerTool(keccak256("MARKET_INTEL"),     "Market Intelligence",  25 * 10**DECIMALS);
    }

    // ─── Execute Query ─────────────────────────────────────────

    /**
     * @dev Pay for an AI query with LDA v1 tokens.
     * User must approve this contract first.
     * 70% goes to burnWallet (out of circulation), 30% to treasury.
     * Emits QueryExecuted → AI backend serves result.
     */
    function executeQuery(bytes32 toolId, bytes32 queryRef) external whenNotPaused {
        // ── Checks ──────────────────────────────────────────────────────
        require(queryRef != bytes32(0), "Invalid queryRef");
        require(!usedRefs[queryRef],    "QueryRef already used");

        Tool storage tool = tools[toolId];
        require(tool.active, "Tool not active");

        uint256 cost = getDiscountedCost(msg.sender, toolId);

        // Subscription: 50% off + daily allowance
        if (_hasActiveSubscription(msg.sender)) {
            Subscription storage sub = subscriptions[msg.sender];
            if (block.timestamp >= sub.dayStart + 1 days) {
                sub.queriesUsedToday = 0;
                sub.dayStart         = block.timestamp;
            }
            if (sub.queriesUsedToday < sub.dailyQueries) {
                sub.queriesUsedToday++;
                cost = cost / 2;
            }
        }

        uint256 burnAmount     = (cost * burnPercent)     / 100;
        uint256 treasuryAmount = (cost * treasuryPercent) / 100;
        // Handle rounding — send any remainder to treasury
        uint256 remainder = cost - burnAmount - treasuryAmount;
        treasuryAmount   += remainder;

        uint256 queryNonce = nonce[msg.sender]++;

        // ── Effects (FIX-2: state updates BEFORE external calls — CEI pattern) ──
        usedRefs[queryRef]       = true;
        queriesRun[msg.sender]   += 1;
        totalSpentBy[msg.sender] += cost;
        tool.totalQueries        += 1;

        // ── Interactions (external calls last) ───────────────────────────
        require(
            ldaToken.transferFrom(msg.sender, address(this), cost),
            "Platform: transfer failed - approve this contract first"
        );
        require(ldaToken.transfer(burnWallet, burnAmount),     "Platform: burn transfer failed");
        require(ldaToken.transfer(treasury,   treasuryAmount), "Platform: treasury transfer failed");

        emit QueryExecuted(msg.sender, toolId, cost, burnAmount, treasuryAmount, queryNonce);
    }

    // ─── Subscription ──────────────────────────────────────────

    function purchaseSubscription() external whenNotPaused {
        uint256 burnAmt     = (monthlySubCost * burnPercent)     / 100;
        uint256 treasuryAmt = (monthlySubCost * treasuryPercent) / 100;
        uint256 remainder   = monthlySubCost - burnAmt - treasuryAmt;
        treasuryAmt        += remainder;

        require(ldaToken.transferFrom(msg.sender, address(this), monthlySubCost), "Transfer failed");
        require(ldaToken.transfer(burnWallet, burnAmt),    "Burn transfer failed");
        require(ldaToken.transfer(treasury,   treasuryAmt),"Treasury transfer failed");

        Subscription storage sub = subscriptions[msg.sender];
        uint256 start      = sub.expiresAt > block.timestamp ? sub.expiresAt : block.timestamp;
        sub.expiresAt      = start + 30 days;
        sub.dailyQueries   = 100;
        sub.queriesUsedToday = 0;
        sub.dayStart       = block.timestamp;

        emit SubscriptionPurchased(msg.sender, sub.expiresAt);
    }

    // ─── Tier System ───────────────────────────────────────────

    enum Tier { None, Bronze, Silver, Gold }

    function getTier(address user) public view returns (Tier) {
        uint256 bal = ldaToken.balanceOf(user);
        if (bal >= goldThreshold)   return Tier.Gold;
        if (bal >= silverThreshold) return Tier.Silver;
        if (bal >= bronzeThreshold) return Tier.Bronze;
        return Tier.None;
    }

    function getDiscountedCost(address user, bytes32 toolId) public view returns (uint256) {
        uint256 base = tools[toolId].baseCost;
        Tier    tier = getTier(user);

        uint256 discountBps;
        if      (tier == Tier.Gold)   discountBps = goldDiscount;
        else if (tier == Tier.Silver) discountBps = silverDiscount;
        else if (tier == Tier.Bronze) discountBps = bronzeDiscount;

        return base - (base * discountBps / 10000);
    }

    // ─── View Helpers ──────────────────────────────────────────

    function getAllTools() external view returns (Tool[] memory) {
        Tool[] memory result = new Tool[](toolIds.length);
        for (uint256 i = 0; i < toolIds.length; i++) {
            result[i] = tools[toolIds[i]];
        }
        return result;
    }

    function getUserStats(address user) external view returns (
        uint256 queries,
        uint256 spent,
        uint256 userNonce,
        Tier    tier,
        bool    hasSub,
        uint256 subExpiry
    ) {
        return (
            queriesRun[user],
            totalSpentBy[user],
            nonce[user],
            getTier(user),
            _hasActiveSubscription(user),
            subscriptions[user].expiresAt
        );
    }

    function _hasActiveSubscription(address user) internal view returns (bool) {
        return subscriptions[user].expiresAt > block.timestamp;
    }

    // ─── Admin ─────────────────────────────────────────────────

    function registerTool(bytes32 toolId, string calldata name_, uint256 cost)
        external onlyOwner
    {
        _registerTool(toolId, name_, cost);
    }

    function _registerTool(bytes32 toolId, string memory name_, uint256 cost) internal {
        require(!tools[toolId].active, "Tool exists");
        tools[toolId] = Tool({ id: toolId, name: name_, baseCost: cost, active: true, totalQueries: 0 });
        toolIds.push(toolId);
        emit ToolRegistered(toolId, name_, cost);
    }

    function updateTool(bytes32 toolId, uint256 newCost, bool active_) external onlyOwner {
        tools[toolId].baseCost = newCost;
        tools[toolId].active   = active_;
        emit ToolUpdated(toolId, newCost, active_);
    }

    // FIX-5: burnWallet and treasury must never equal each other
    // FIX-8: treasury change requires 48-hour timelock
    function proposeTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Zero address");
        require(newTreasury != burnWallet,  "Cannot equal burn wallet");
        pendingTreasury    = newTreasury;
        treasuryChangeAfter = block.timestamp + TREASURY_TIMELOCK;
        emit TreasuryChangeProposed(newTreasury, treasuryChangeAfter);
    }

    function applyTreasury() external onlyOwner {
        require(pendingTreasury != address(0), "No pending treasury");
        require(block.timestamp >= treasuryChangeAfter, "Timelock not elapsed");
        address previous = treasury;
        treasury         = pendingTreasury;
        pendingTreasury  = address(0);
        emit TreasuryChanged(previous, treasury);
    }

    function setBurnWallet(address newBurnWallet) external onlyOwner {
        require(newBurnWallet != address(0), "Zero address");
        require(newBurnWallet != treasury,   "Cannot equal treasury");  // FIX-5
        burnWallet = newBurnWallet;
    }

    function setBurnSplit(uint256 _burnPct, uint256 _treasuryPct) external onlyOwner {
        require(_burnPct + _treasuryPct == 100, "Must sum to 100");
        require(_burnPct >= 50 && _burnPct <= 90, "Burn 50-90% only");
        burnPercent     = _burnPct;
        treasuryPercent = _treasuryPct;
        emit BurnSplitUpdated(_burnPct, _treasuryPct);
    }

    function setDiscounts(uint256 bronze, uint256 silver, uint256 gold) external onlyOwner {
        require(bronze < silver && silver < gold, "Invalid order");
        require(gold <= 5000, "Max 50% discount");
        bronzeDiscount = bronze;
        silverDiscount = silver;
        goldDiscount   = gold;
    }

    function setTierThresholds(uint256 bronze, uint256 silver, uint256 gold) external onlyOwner {
        require(bronze < silver && silver < gold, "Invalid thresholds");
        bronzeThreshold = bronze;
        silverThreshold = silver;
        goldThreshold   = gold;
    }

    function setSubCost(uint256 cost) external onlyOwner { monthlySubCost = cost; }
    function pause()   external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    // FIX-3 + FIX-9: two-step ownership transfer with events
    function proposeOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }
}
