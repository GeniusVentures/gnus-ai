pragma solidity >0.4.99 < 0.6.0;
import "@openzeppelin/contracts/ownership/Ownable.sol";        // set specific function for owner only
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";            // safe mathematics functions
// import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
// import "openzeppelin-solidity/contracts/math/SafeMath.sol";
// import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
// import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
// import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
// import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
// import "openzeppelin-solidity/contracts/ownership/Ownable.sol"; 

// import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./helper/GNUSToken.sol";
/**
 * @title ComPayChannel contract
 * @notice A ComPayChannel is contract for implementing simple payment channel.    
 */
contract ComPayChannel  is Ownable{
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    struct PayChannel {
        // corresponding to source address. Owner of this address creates payment channel
        address sender;
        // corresponding to destination address. Owner of destination address will receive Genius Token by closing payment channel
        address receiver;                   
        // amount deposited by source
        uint depositAmount;
        // data needed for computing
        bytes data;
        // length of data
        uint dataLen; 
        // block number when channel is created.
        uint blockNumber;
    }
    
    mapping(bytes32 => PayChannel) private paychannels;
    uint _id;
    address public geniusTokenAddress;

    GNUSToken  geniusToken;
    
    // Define events for opening channel, depositing genius token, and closing channel.
    event OpenChannel(
        bytes32 indexed payId,                
        address from,
        address to,
        uint depositAmount
    );

    
    event Deposit(bytes32 indexed payId, address sender, uint amount);
    event Transfer(bytes32 indexed payId, address receiver, uint amount);
    /**
     * @notice ComPayChannel constructor
     * @param _geniusTokenAddress address of genius token contract
     */
    constructor(address _geniusTokenAddress) public payable{
         geniusToken = GNUSToken(_geniusTokenAddress);        
         geniusTokenAddress = _geniusTokenAddress;
         _id = 0;
    }

    /**
     * @notice  Throws if called by any account other than sender of payment chanenl
     * @param _payId id of the Payment channel to be operated
     */
    modifier onlySender(bytes32 _payId) {
        require(msg.sender == paychannels[_payId].sender, "msg.sender is not operator");
        _;
    }    

    /**
     * @notice  Throws if called by any account other than receiver of payment chanenl
     * @param _payId id of the Payment channel to be operated
     */
    modifier onlyReceiver(bytes32 _payId) {
        require(msg.sender == paychannels[_payId].receiver, "msg.sender is not operator");
        _;
    }  

    /**
     * @notice Open a payment channel with deposit genius token    
     * @param _to address to be transfer genius token
     * @param _depositAmount deposit amount for genius token
     * @param _data bytes of open channel request data     
     * @param _dataLen length of data
     */
     function OpenPaymentChannel(address _to, uint _depositAmount, bytes calldata _data, uint _dataLen) external returns(bytes32){
          require(_depositAmount > 0, "_depositAmount is not 0");
        //   bytes32 c = keccak256(abi.encodePacked(_id++));      
        
        bytes32 c = keccak256(abi.encodePacked(msg.sender, block.number));      
        paychannels[c] = PayChannel( {sender: msg.sender, receiver: _to, depositAmount: _depositAmount, data: _data, dataLen: _dataLen, blockNumber:block.number});
        _id++;
        //   deposit genius token          
        // IERC20(geniusTokenAddress).safeTransferFrom(msg.sender, address(this), _depositAmount);
        // ERC20 token = ERC20(geniusTokenAddress);
        // token.transferFrom(msg.sender, address(this), 10);
        // token.transferFrom(msg.sender, address(this), _depositAmount); 
        // geniusToken.increaseAllowance(address(this), _depositAmount);       
        // geniusToken.approve(msg.sender, _depositAmount);
        geniusToken.transferFrom(msg.sender, address(this), _depositAmount);
        // geniusToken.transfer(address(this), _depositAmount);
        // geniusToken.transfer(_to, _depositAmount);
        // emit Deposit( c, msg.sender, _depositAmount);
           emit OpenChannel(c, msg.sender, _to, _depositAmount);
           return c;
     }

     /**
     * @notice Close a payment channel     
     * @param _amount amount for genius token cliam          
     * @param _payId  id of payment channel created by sender
     */
     function ClosePaymentChannel(bytes32 _payId, uint _amount) public payable onlyReceiver(_payId){
        
        if (_amount == 0) { return; }                
        PayChannel memory c = paychannels[_payId];

        require(_amount < c.depositAmount, "deposited amount is not sufficient.");                        
        _transferGNUS(_payId, c.receiver, _amount);
        // refund remainder genius token to sender address.
        if(_amount <c.depositAmount)        
          {
              _transferGNUS(_payId, c.sender, c.depositAmount - _amount);
          } 
        delete paychannels[_payId];
     }
    /**
    * @notice transfer genius token
    * @param _payId payment channel id
    * @param _receiver address to receive genius token
    * @param _amount amount for withdraw
     */
    function _transferGNUS(bytes32 _payId, address _receiver, uint _amount) internal {        
        geniusToken.transfer( _receiver , _amount);
        // geniusToken.safeTransferFrom(address(this), _receiver , _amount);
        // IERC20(geniusTokenAddress).safeTransfer(_receiver, _amount);
        emit Transfer(_payId, _receiver, _amount);
    }

    /**
    * @notice get number of payment channel    
     */
     function getNumberOfChannels() public view returns(uint){
         return _id;
     }
     /**
     * @notice get genius token address 
     */
     function getGeniusTokenAddress() public view returns(address){
         return geniusTokenAddress;
     }
     
     /**
     * @notice get payment channel Id with sender address and blockNumber
     * @param _senderAddress sender address
     * @param _blockNumber number of blocknumber created payment channel.     
      */
      function GetPaymentChannelId(address _senderAddress, uint _blockNumber) public pure returns(bytes32){
          return keccak256(abi.encodePacked(_senderAddress, _blockNumber));
      }
    /**
    * @notice get info for payment channel
    * @param payId  id for payment channnel to get
     */
     function GetPaymentChannelInfo(bytes32 payId) public view returns(address, address, uint) {
         PayChannel memory c=paychannels[payId];
         return(c.sender, c.receiver, c.depositAmount);
     }




}
