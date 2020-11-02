// Based on https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/examples/SimpleToken.sol
pragma solidity ^0.5.1;

// import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
// import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

/**
 * @title GNUSToken
 * @notice here GNUSToken is defined.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `ERC20` functions.
 */
contract GNUSToken is ERC20, ERC20Detailed {
    uint8 public constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 250000000 * 10 ** 18;

    // balances correspending to supergenius token. it's value must be same as supergenius
    mapping (address => uint256) private _sgns_balances;


    /**
     * @notice Constructor that gives msg.sender all of existing tokens.
     */
    constructor () public ERC20Detailed("GNUSToken", "GNUS", DECIMALS) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    // This function  is used to get computing operation.
    // 20%  of amount will send to owner

    // function transferForOperation(address recipient, uint256 amount) external {
        
    //     uint value = msg.value;

    //     // update sgns_balances.
    //     if (amount > 0)
    //     {
    //          _sgns_balances[recipient]  += amount;
    //          if(_sgns_balances[msg.sender] > amount)            
    //             _sgns_balances[msg.sender] -= amount;
    //     }           
    // }

    // This function is used to refund when user don't get result required.
    
    // function refund(address recipent, uint256 amount) {

    //  if(amount > 0)
    //  {
    //     _sgns_balances[msg.sender] += amount;
    //     if(_sgns_balances[recipient] > amount)            
    //         _sgns_balances[recipient] -= amount;
    //  }

    // }

}