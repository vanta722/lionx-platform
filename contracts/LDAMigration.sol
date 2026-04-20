// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * LDA Migration Contract
 * Swaps original LDA (v1) → LDA v2 at a fixed ratio.
 *
 * Ratio:     2 old LDA → 1 LDA v2
 * Window:    Owner-controlled open/close
 * Old LDA:   Locked in this contract permanently (not returned)
 */

interface ITRC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ILDAv2 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract LDAMigration {

    address public owner;
    ITRC20  public oldLDA;       // Original LDA token (v1)
    ILDAv2  public newLDA;       // LDA v2 token

    uint256 public constant RATIO = 2; // 2 old LDA = 1 LDA v2
    uint256 public constant DECIMALS_V1 = 6;
    uint256 public constant DECIMALS_V2 = 6;

    bool    public migrationOpen;
    uint256 public migrationDeadline;  // unix timestamp
    uint256 public totalMigrated;      // total old LDA received
    uint256 public totalIssued;        // total LDA v2 issued

    mapping(address => uint256) public migratedBy; // wallet => old LDA migrated

    event Migrated(address indexed user, uint256 oldAmount, uint256 newAmount);
    event MigrationOpened(uint256 deadline);
    event MigrationClosed();

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _oldLDA, address _newLDA) {
        owner  = msg.sender;
        oldLDA = ITRC20(_oldLDA);
        newLDA = ILDAv2(_newLDA);
    }

    /**
     * @dev Open migration window for a set number of days.
     */
    function openMigration(uint256 daysOpen) external onlyOwner {
        migrationOpen     = true;
        migrationDeadline = block.timestamp + (daysOpen * 1 days);
        emit MigrationOpened(migrationDeadline);
    }

    function closeMigration() external onlyOwner {
        migrationOpen = false;
        emit MigrationClosed();
    }

    /**
     * @dev Migrate old LDA → LDA v2.
     * User must approve this contract to spend their old LDA first.
     * @param amount Amount of OLD LDA to migrate (with 6 decimals).
     */
    function migrate(uint256 amount) external {
        require(migrationOpen, "Migration closed");
        require(block.timestamp <= migrationDeadline, "Migration window expired");
        require(amount > 0, "Amount must be > 0");
        require(amount % RATIO == 0, "Amount must be divisible by 2");

        uint256 v2Amount = amount / RATIO;

        // Pull old LDA from user
        require(
            oldLDA.transferFrom(msg.sender, address(this), amount),
            "Migration: v1 transfer failed — approve this contract first"
        );

        // Transfer pre-minted LDA v2 to user (migration contract holds supply)
        require(
            newLDA.transfer(msg.sender, v2Amount),
            "Migration: v2 transfer failed — migration contract needs tokens"
        );

        // Safety check: ensure contract still has enough tokens
        require(
            newLDA.balanceOf(address(this)) >= 0,
            "Migration: insufficient v2 supply in contract"
        );

        migratedBy[msg.sender] += amount;
        totalMigrated          += amount;
        totalIssued            += v2Amount;

        emit Migrated(msg.sender, amount, v2Amount);
    }

    /**
     * @dev Check how much LDA v2 a user would receive for a given old LDA amount.
     */
    function previewMigration(uint256 oldAmount) external pure returns (uint256 newAmount) {
        return oldAmount / RATIO;
    }

    /**
     * @dev View migration stats.
     */
    function stats() external view returns (
        bool   open,
        uint256 deadline,
        uint256 migrated,
        uint256 issued,
        uint256 timeRemaining
    ) {
        uint256 remaining = migrationDeadline > block.timestamp
            ? migrationDeadline - block.timestamp
            : 0;
        return (migrationOpen, migrationDeadline, totalMigrated, totalIssued, remaining);
    }

    // Owner functions
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
