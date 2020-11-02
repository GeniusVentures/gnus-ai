pragma solidity ^0.5.1;

/**
 * @title Storate Test  contract
 * @notice This is contract for testing simple storage 
 */
contract StorageTest {
    uint storageData;
    
    /**
     * @notice set function 
     * @param x unit variable for storing
     */
    function set(uint x) public {
        storageData = x;
    }

    /** 
    @notice function to get stored data
     */
    function get() public view returns (uint) {
        return storageData;
    }

}
