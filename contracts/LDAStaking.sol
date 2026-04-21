// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * LDA v2 Staking Contract
 *
 * Lock LDA v2 → earn rewards from platform treasury.
 *
 * Lock periods:
 *   30 days  → 1x reward multiplier
 *   90 days  → 1.5x reward multiplier
 *   180 days → 2.5x reward multiplier
 *   365 days → 4x reward multiplier
 *
 * Rewards funded by:
 *   - Owner deposits TRX or LDA v2 to reward pool
 *   - Treasury wallet feeds rewards periodically
 *
 * Tier boost:
 *   Gold holders → +10% bonus on all rewards
 */

interface ITRC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ILDAv2 {
    enum Tier { None, Bronze, Silver, Gold }
    function getTier(address account) external view returns (Tier);
    function mint(address to, uint256 amount) external;
}

contract LDAStaking {

    address public owner;
    ITRC20  public ldaToken;
    ILDAv2  public ldaInterface;

    // ── Lock Period Config ──
    struct LockOption {
        uint256 duration;    // seconds
        uint256 multiplierX10; // multiplier * 10 (e.g., 15 = 1.5x)
        string  label;
    }

    LockOption[] public lockOptions;

    // ── Stake Record ──
    struct Stake {
        uint256 amount;
        uint256 lockStart;
        uint256 lockEnd;
        uint256 multiplierX10;
        bool    withdrawn;
        uint256 rewardDebt;
    }

    mapping(address => Stake[]) public stakes;
    mapping(address => uint256) public totalStaked;

    // ── Reward Pool ──
    uint256 public rewardPool;
    uint256 public rewardRatePerDay;   // LDA v2 per 1M staked per day (set by owner)
    uint256 public totalValueLocked;

    // ── Events ──
    event Staked(address indexed user, uint256 amount, uint256 lockDays, uint256 stakeIndex);
    event Unstaked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 reward);
    event RewardDeposited(uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event EarlyExitPenalty(address indexed user, uint256 penalty);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _ldaToken) {
        owner        = msg.sender;
        ldaToken     = ITRC20(_ldaToken);
        ldaInterface = ILDAv2(_ldaToken);
        rewardRatePerDay = 10; // 10 LDA v2 per 1M staked per day (adjustable)

        // Initialize lock options
        lockOptions.push(LockOption({ duration: 30  days, multiplierX10: 10, label: "30 Days"  }));
        lockOptions.push(LockOption({ duration: 90  days, multiplierX10: 15, label: "90 Days"  }));
        lockOptions.push(LockOption({ duration: 180 days, multiplierX10: 25, label: "180 Days" }));
        lockOptions.push(LockOption({ duration: 365 days, multiplierX10: 40, label: "1 Year"   }));
    }

    /**
     * @dev Stake LDA v2 for a chosen lock period.
     * @param amount      Amount of LDA v2 to stake
     * @param optionIndex Index of lock option (0=30d, 1=90d, 2=180d, 3=365d)
     */
    function stake(uint256 amount, uint256 optionIndex) external {
        require(amount > 0, "Amount must be > 0");
        require(optionIndex < lockOptions.length, "Invalid lock option");

        LockOption memory opt = lockOptions[optionIndex];

        require(
            ldaToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        uint256 idx = stakes[msg.sender].length;
        stakes[msg.sender].push(Stake({
            amount:        amount,
            lockStart:     block.timestamp,
            lockEnd:       block.timestamp + opt.duration,
            multiplierX10: opt.multiplierX10,
            withdrawn:     false,
            rewardDebt:    0
        }));

        totalStaked[msg.sender] += amount;
        totalValueLocked        += amount;

        emit Staked(msg.sender, amount, opt.duration / 1 days, idx);
    }

    /**
     * @dev Unstake after lock period expires. Receive principal + rewards.
     */
    function unstake(uint256 stakeIndex) external {
        Stake storage s = stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(block.timestamp >= s.lockEnd, "Still locked — use emergencyExit()");

        uint256 reward = calculateReward(msg.sender, stakeIndex);
        s.withdrawn    = true;

        totalStaked[msg.sender] -= s.amount;
        totalValueLocked        -= s.amount;

        // Return principal
        require(ldaToken.transfer(msg.sender, s.amount), "Principal transfer failed");

        // Pay reward from pool
        if (reward > 0 && rewardPool >= reward) {
            rewardPool -= reward;
            ldaInterface.mint(msg.sender, reward);
        }

        emit Unstaked(msg.sender, stakeIndex, s.amount, reward);
    }

    /**
     * @dev Emergency exit before lock expires. 20% penalty on principal.
     * Penalty goes to reward pool (benefits remaining stakers).
     */
    function emergencyExit(uint256 stakeIndex) external {
        Stake storage s = stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(block.timestamp < s.lockEnd, "Lock expired — use unstake()");

        uint256 penalty  = (s.amount * 20) / 100;
        uint256 returnAmt = s.amount - penalty;

        s.withdrawn = true;
        totalStaked[msg.sender] -= s.amount;
        totalValueLocked        -= s.amount;

        rewardPool += penalty; // penalty feeds other stakers

        require(ldaToken.transfer(msg.sender, returnAmt), "Transfer failed");
        emit EarlyExitPenalty(msg.sender, penalty);
        emit Unstaked(msg.sender, stakeIndex, returnAmt, 0);
    }

    /**
     * @dev Calculate reward for a stake position.
     * Reward = (amount / 1M) * rewardRatePerDay * daysStaked * (multiplierX10 / 10)
     * Gold tier holders receive +10% bonus.
     */
    function calculateReward(address user, uint256 stakeIndex)
        public view returns (uint256)
    {
        Stake storage s = stakes[user][stakeIndex];
        if (s.withdrawn) return 0;

        uint256 endTime  = block.timestamp < s.lockEnd ? block.timestamp : s.lockEnd;
        uint256 elapsed  = endTime - s.lockStart;
        uint256 days_    = elapsed / 1 days;

        if (days_ == 0) return 0;

        // Base reward
        uint256 base = (s.amount * rewardRatePerDay * days_ * s.multiplierX10)
                       / (1_000_000 * 10 * 10**6); // normalize for decimals

        // Gold tier bonus (+10%)
        ILDAv2.Tier tier = ldaInterface.getTier(user);
        if (tier == ILDAv2.Tier.Gold) {
            base = (base * 110) / 100;
        }

        return base;
    }

    /**
     * @dev Get all stakes for a user.
     */
    function getStakes(address user) external view returns (Stake[] memory) {
        return stakes[user];
    }

    function getStakeCount(address user) external view returns (uint256) {
        return stakes[user].length;
    }

    /**
     * @dev Get lock options.
     */
    function getLockOptions() external view returns (LockOption[] memory) {
        return lockOptions;
    }

    // ── Admin ──

    function depositRewards(uint256 amount) external onlyOwner {
        require(ldaToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        rewardPool += amount;
        emit RewardDeposited(amount);
    }

    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRatePerDay = newRate;
        emit RewardRateUpdated(newRate);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
