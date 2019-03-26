pragma solidity ^0.5.0;

/**
 * @title BooleanCond interface
 */
interface IBooleanCond {
    function isFinalized(bytes calldata _query) external view returns (bool);
    
    function getResult(bytes calldata _query) external view returns (bool);
}