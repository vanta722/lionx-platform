// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * Mock LDA v1 — Shasta Testnet Only
 * Simulates the original Lion Digital Alliance token for migration testing.
 * DO NOT deploy to mainnet.
 */
contract MockLDAv1 {

    string public constant name     = "Lion Digital Alliance";
    string public constant symbol   = "LDA";
    uint8  public constant decimals = 6;

    uint256 private _totalSupply;
    address public  owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() { owner = msg.sender; }

    function totalSupply() external view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view returns (uint256) { return _balances[account]; }
    function allowance(address _owner, address spender) external view returns (uint256) { return _allowances[_owner][spender]; }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to]   += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // Mint test tokens to any address — testnet only
    function mint(address to, uint256 amount) external onlyOwner {
        _totalSupply    += amount;
        _balances[to]   += amount;
        emit Transfer(address(0), to, amount);
    }

    // Self-mint for testing — anyone can grab test tokens
    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 10**6, "Max 10,000 LDA v1 per faucet call");
        _totalSupply         += amount;
        _balances[msg.sender] += amount;
        emit Transfer(address(0), msg.sender, amount);
    }
}
