// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * ██╗     ██████╗  █████╗     ██╗   ██╗██████╗
 * ██║     ██╔══██╗██╔══██╗    ██║   ██║╚════██╗
 * ██║     ██║  ██║███████║    ██║   ██║ █████╔╝
 * ██║     ██║  ██║██╔══██║    ╚██╗ ██╔╝██╔═══╝
 * ███████╗██████╔╝██║  ██║     ╚████╔╝ ███████╗
 * ╚══════╝╚═════╝ ╚═╝  ╚═╝      ╚═══╝  ╚══════╝
 *
 * Lion Digital Alliance V2 — LDA
 * Token-gated AI platform token on Tron
 *
 * Max Supply:    10,000,000 LDA v2
 * Decimals:      6
 * Burn Split:    70% burned / 30% treasury
 * Network:       Tron (TRC-20 / TVM)
 *
 * Phase 1 Features:
 *   - Hard capped supply (no inflation ever)
 *   - Native burn + burnFrom for platform queries
 *   - 70/30 burn/treasury split on every query
 *   - Tiered access: Bronze / Silver / Gold
 *   - Platform whitelist (only authorized contracts can burnFrom)
 *   - Emergency pause
 *   - Builder revenue share registry
 *   - 2-step ownership transfer
 *
 * Phase 2 (separate GovernanceLDA contract):
 *   - On-chain snapshot voting with balance checkpointing
 *   - Proposal creation + voting via balanceOf() on this token
 */

// ─── Interfaces ────────────────────────────────────────────────

interface ITRC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// ─── LDA v2 Main Contract ──────────────────────────────────────

contract LDAv2 is ITRC20 {

    // ── Token Identity ──
    string public constant name     = "Lion Digital Alliance V2";
    string public constant symbol   = "LDA";
    uint8  public constant decimals = 6;

    // ── Hard Cap — NEVER changes ──
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**6; // 10M tokens

    // ── Supply tracking ──
    uint256 private _totalSupply;
    uint256 public  totalBurned;

    // ── Balances & Allowances ──
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Ownership ──
    address public owner;
    address public pendingOwner;

    // ── Treasury ──
    address public treasuryWallet;
    uint256 public burnPercent     = 70;
    uint256 public treasuryPercent = 30;

    // ── Platform Authorization ──
    mapping(address => bool) public authorizedPlatforms;

    // ── Emergency Pause ──
    bool public paused;

    // ── Tiered Access Thresholds ──
    uint256 public bronzeThreshold  =    500 * 10**6;
    uint256 public silverThreshold  =  2_000 * 10**6;
    uint256 public goldThreshold    = 10_000 * 10**6;

    // ── Builder Revenue Share ──
    struct Builder {
        address wallet;
        uint256 sharePercent;
        bool    active;
        uint256 totalEarned;
    }
    mapping(bytes32 => Builder) public builders;
    bytes32[] public registeredTools;

    // ── Staking ──
    address public stakingContract;

    // ── Events ──
    event Burned(address indexed from, uint256 burnAmount, uint256 treasuryAmount, bytes32 toolId);
    event PlatformAuthorized(address indexed platform, bool status);
    event TreasuryWalletUpdated(address indexed newTreasury);
    event BurnSplitUpdated(uint256 burnPct, uint256 treasuryPct);
    event TierThresholdsUpdated(uint256 bronze, uint256 silver, uint256 gold);
    event BuilderRegistered(bytes32 indexed toolId, address indexed wallet, uint256 sharePercent);
    event BuilderPaid(bytes32 indexed toolId, address indexed wallet, uint256 amount);
    event OwnershipTransferInitiated(address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event Paused(address by);
    event Unpaused(address by);
    event StakingContractSet(address indexed stakingContract);

    // ── Modifiers ──
    modifier onlyOwner() {
        require(msg.sender == owner, "LDA: not owner");
        _;
    }
    modifier whenNotPaused() {
        require(!paused, "LDA: contract paused");
        _;
    }
    modifier onlyAuthorizedPlatform() {
        require(authorizedPlatforms[msg.sender], "LDA: not authorized platform");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────

    constructor(address _treasury) {
        require(_treasury != address(0), "LDA: zero treasury");
        owner          = msg.sender;
        treasuryWallet = _treasury;
    }

    // ─── TRC-20 Core ───────────────────────────────────────────

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount)
        external override whenNotPaused returns (bool)
    {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount)
        external override returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external override whenNotPaused returns (bool)
    {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= amount, "LDA: insufficient allowance");
        _approve(from, msg.sender, allowed - amount);
        _transfer(from, to, amount);
        return true;
    }

    function allowance(address _owner, address spender)
        external view override returns (uint256)
    {
        return _allowances[_owner][spender];
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 current = _allowances[msg.sender][spender];
        require(current >= subtractedValue, "LDA: allowance below zero");
        _approve(msg.sender, spender, current - subtractedValue);
        return true;
    }

    // ─── Minting (Owner Only, Hard Cap Enforced) ───────────────

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "LDA: mint to zero");
        require(_totalSupply + amount <= MAX_SUPPLY, "LDA: exceeds hard cap");
        _totalSupply  += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // ─── Burn Mechanics ────────────────────────────────────────

    function burn(uint256 amount) external whenNotPaused {
        _splitBurn(msg.sender, amount, bytes32(0));
    }

    function burnFrom(address account, uint256 amount, bytes32 toolId)
        external whenNotPaused onlyAuthorizedPlatform
    {
        uint256 currentAllowance = _allowances[account][msg.sender];
        require(currentAllowance >= amount, "LDA: insufficient allowance");
        _approve(account, msg.sender, currentAllowance - amount);
        _splitBurn(account, amount, toolId);
    }

    function _splitBurn(address from, uint256 amount, bytes32 toolId) internal {
        require(_balances[from] >= amount, "LDA: burn exceeds balance");

        uint256 burnAmount     = (amount * burnPercent) / 100;
        uint256 treasuryAmount = amount - burnAmount;

        _balances[from] -= burnAmount;
        _totalSupply    -= burnAmount;
        totalBurned     += burnAmount;
        emit Transfer(from, address(0), burnAmount);

        if (toolId != bytes32(0) && builders[toolId].active) {
            Builder storage b   = builders[toolId];
            uint256 builderCut  = (treasuryAmount * b.sharePercent) / 100;
            uint256 platformCut = treasuryAmount - builderCut;
            _transfer(from, b.wallet, builderCut);
            _transfer(from, treasuryWallet, platformCut);
            b.totalEarned += builderCut;
            emit BuilderPaid(toolId, b.wallet, builderCut);
        } else {
            _transfer(from, treasuryWallet, treasuryAmount);
        }

        emit Burned(from, burnAmount, treasuryAmount, toolId);
    }

    // ─── Tiered Access ─────────────────────────────────────────

    enum Tier { None, Bronze, Silver, Gold }

    function getTier(address account) external view returns (Tier) {
        uint256 bal = _balances[account];
        if (bal >= goldThreshold)   return Tier.Gold;
        if (bal >= silverThreshold) return Tier.Silver;
        if (bal >= bronzeThreshold) return Tier.Bronze;
        return Tier.None;
    }

    function setTierThresholds(uint256 _bronze, uint256 _silver, uint256 _gold)
        external onlyOwner
    {
        require(_bronze < _silver && _silver < _gold, "LDA: invalid thresholds");
        bronzeThreshold = _bronze;
        silverThreshold = _silver;
        goldThreshold   = _gold;
        emit TierThresholdsUpdated(_bronze, _silver, _gold);
    }

    // ─── Platform Authorization ────────────────────────────────

    function setAuthorizedPlatform(address platform, bool status) external onlyOwner {
        require(platform != address(0), "LDA: zero address");
        authorizedPlatforms[platform] = status;
        emit PlatformAuthorized(platform, status);
    }

    // ─── Builder Revenue Share ─────────────────────────────────

    function registerBuilder(bytes32 toolId, address wallet, uint256 sharePct)
        external onlyOwner
    {
        require(wallet  != address(0), "LDA: zero wallet");
        require(sharePct <= 80,        "LDA: share too high");
        require(!builders[toolId].active, "LDA: already registered");
        builders[toolId] = Builder({ wallet: wallet, sharePercent: sharePct, active: true, totalEarned: 0 });
        registeredTools.push(toolId);
        emit BuilderRegistered(toolId, wallet, sharePct);
    }

    function updateBuilder(bytes32 toolId, address wallet, uint256 sharePct)
        external onlyOwner
    {
        require(builders[toolId].active, "LDA: not found");
        require(sharePct <= 80, "LDA: share too high");
        builders[toolId].wallet       = wallet;
        builders[toolId].sharePercent = sharePct;
    }

    function deactivateBuilder(bytes32 toolId) external onlyOwner {
        builders[toolId].active = false;
    }

    function getRegisteredToolCount() external view returns (uint256) {
        return registeredTools.length;
    }

    // ─── Staking Hook ──────────────────────────────────────────

    function setStakingContract(address _staking) external onlyOwner {
        require(_staking != address(0), "LDA: zero address");
        stakingContract = _staking;
        authorizedPlatforms[_staking] = true;
        emit StakingContractSet(_staking);
    }

    // ─── Treasury & Split Config ───────────────────────────────

    function setTreasuryWallet(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "LDA: zero address");
        treasuryWallet = newTreasury;
        emit TreasuryWalletUpdated(newTreasury);
    }

    function setBurnSplit(uint256 _burnPct, uint256 _treasuryPct) external onlyOwner {
        require(_burnPct + _treasuryPct == 100, "LDA: must sum to 100");
        require(_burnPct >= 50 && _burnPct <= 90, "LDA: burn 50-90% only");
        burnPercent     = _burnPct;
        treasuryPercent = _treasuryPct;
        emit BurnSplitUpdated(_burnPct, _treasuryPct);
    }

    // ─── Emergency Pause ───────────────────────────────────────

    function pause()   external onlyOwner { paused = true;  emit Paused(msg.sender);   }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }

    // ─── Ownership Transfer (2-step) ───────────────────────────

    function initiateOwnershipTransfer(address newOwner) external onlyOwner {
        require(newOwner != address(0), "LDA: zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "LDA: not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ─── View Helpers ──────────────────────────────────────────

    function circulatingSupply() external view returns (uint256) { return _totalSupply; }

    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - _totalSupply;
    }

    // ─── Internal ──────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "LDA: from zero");
        require(to   != address(0), "LDA: to zero");
        require(_balances[from] >= amount, "LDA: insufficient balance");
        _balances[from] -= amount;
        _balances[to]   += amount;
        emit Transfer(from, to, amount);
    }

    function _approve(address _owner, address spender, uint256 amount) internal {
        require(_owner  != address(0), "LDA: owner zero");
        require(spender != address(0), "LDA: spender zero");
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }
}
