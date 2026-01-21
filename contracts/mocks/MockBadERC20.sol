// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title Mock ERC20 with Failure Modes
/// @notice ERC20 mock that can be configured to fail transfers
contract MockBadERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    bool public shouldFailTransfer;
    bool public shouldFailApprove;
    bool public shouldReturnFalse;
    bool public shouldReturnNothing;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function setFailTransfer(bool _fail) external {
        shouldFailTransfer = _fail;
    }

    function setFailApprove(bool _fail) external {
        shouldFailApprove = _fail;
    }

    function setReturnFalse(bool _returnFalse) external {
        shouldReturnFalse = _returnFalse;
    }

    function setReturnNothing(bool _returnNothing) external {
        shouldReturnNothing = _returnNothing;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (shouldFailTransfer) {
            revert("Transfer failed");
        }
        if (shouldReturnFalse) {
            return false;
        }

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);

        if (shouldReturnNothing) {
            // Don't return anything - some tokens do this
            assembly {
                return(0, 0)
            }
        }
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (shouldFailApprove) {
            revert("Approve failed");
        }
        if (shouldReturnFalse) {
            return false;
        }

        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);

        if (shouldReturnNothing) {
            assembly {
                return(0, 0)
            }
        }
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (shouldFailTransfer) {
            revert("TransferFrom failed");
        }
        if (shouldReturnFalse) {
            return false;
        }

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);

        if (shouldReturnNothing) {
            assembly {
                return(0, 0)
            }
        }
        return true;
    }
}
