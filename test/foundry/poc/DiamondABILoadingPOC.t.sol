// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

/// @title Diamond ABI Loading Proof of Concept
/// @notice Tests the capability of vm.parseJson() to load and parse Diamond ABI
/// @dev This is a research/POC test to validate the approach for Task 1.1-1.4
contract DiamondABILoadingPOC is Test {
    string constant DIAMOND_ABI_PATH = "./diamond-abi/GeniusDiamond.json";

    /// @notice Test reading the Diamond ABI file
    /// @dev Task 1.1 & 1.2: Research and test vm.parseJson() capability
    function test_ReadDiamondABI() public {
        // Read the entire ABI file as a string
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Verify we got data
        assertTrue(bytes(abiJson).length > 0, "ABI file should not be empty");

        // Log for debugging
        console.log("Successfully read Diamond ABI file");
        console.log("File size (bytes):", bytes(abiJson).length);
    }

    /// @notice Test parsing the ABI array from the JSON
    /// @dev Task 1.3: Extract function selectors from Diamond ABI
    function test_ParseABIArray() public {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Parse the ABI array from the JSON
        // The structure is { "abi": [...], ... }
        bytes memory abiArrayBytes = vm.parseJson(abiJson, ".abi");

        // Verify we got the ABI array
        assertTrue(abiArrayBytes.length > 0, "ABI array should not be empty");

        console.log("Successfully parsed ABI array");
        console.log("ABI array size (bytes):", abiArrayBytes.length);
    }

    /// @notice Test extracting function names from ABI
    /// @dev Task 1.4: Extract function signatures for call encoding
    function test_ExtractFunctionNames() public {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Try to parse individual ABI entries
        // We'll look for functions (type: "function")

        // First, let's try to get the first ABI entry's type
        string memory firstEntryType = abi.decode(vm.parseJson(abiJson, ".abi[0].type"), (string));

        console.log("First ABI entry type:", firstEntryType);

        // Count approximate number of entries by trying to parse indices
        uint256 count = 0;
        for (uint256 i = 0; i < 200; i++) {
            try
                vm.parseJson(abiJson, string(abi.encodePacked(".abi[", vm.toString(i), "].type")))
            returns (bytes memory) {
                count++;
            } catch {
                break;
            }
        }

        console.log("Approximate number of ABI entries:", count);
        assertTrue(count > 0, "Should have at least one ABI entry");
    }

    /// @notice Test extracting specific function selectors
    /// @dev Task 1.3: Demonstrate extracting selectors for validation
    function test_ExtractFunctionSelector() public {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Try to find a specific function and extract its selector
        // We'll iterate through ABI entries looking for functions

        bool foundFunction = false;
        string memory functionName;

        for (uint256 i = 0; i < 200; i++) {
            string memory indexPath = string(abi.encodePacked(".abi[", vm.toString(i), "]"));

            try vm.parseJson(abiJson, string(abi.encodePacked(indexPath, ".type"))) returns (
                bytes memory typeBytes
            ) {
                string memory entryType = abi.decode(typeBytes, (string));

                if (keccak256(bytes(entryType)) == keccak256(bytes("function"))) {
                    // Found a function, get its name
                    bytes memory nameBytes = vm.parseJson(
                        abiJson,
                        string(abi.encodePacked(indexPath, ".name"))
                    );
                    functionName = abi.decode(nameBytes, (string));
                    foundFunction = true;

                    console.log("Found function:", functionName);
                    console.log("At index:", i);
                    break;
                }
            } catch {
                break;
            }
        }

        assertTrue(foundFunction, "Should find at least one function in ABI");
    }

    /// @notice Test building function signatures for encoding
    /// @dev Task 1.4: Extract function signatures for call encoding
    function test_BuildFunctionSignature() public {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Look for a function and try to build its signature
        // Signature format: "functionName(type1,type2,...)"

        for (uint256 i = 0; i < 200; i++) {
            string memory indexPath = string(abi.encodePacked(".abi[", vm.toString(i), "]"));

            try vm.parseJson(abiJson, string(abi.encodePacked(indexPath, ".type"))) returns (
                bytes memory typeBytes
            ) {
                string memory entryType = abi.decode(typeBytes, (string));

                if (keccak256(bytes(entryType)) == keccak256(bytes("function"))) {
                    // Found a function
                    string memory functionName = abi.decode(
                        vm.parseJson(abiJson, string(abi.encodePacked(indexPath, ".name"))),
                        (string)
                    );

                    console.log("\n=== Function Details ===");
                    console.log("Name:", functionName);

                    // Try to get inputs
                    try
                        vm.parseJson(abiJson, string(abi.encodePacked(indexPath, ".inputs")))
                    returns (bytes memory inputsBytes) {
                        console.log("Has inputs, length:", inputsBytes.length);

                        // Successfully extracted function information
                        // In a real implementation, we'd parse inputs to build the full signature
                        return;
                    } catch {
                        console.log("No inputs or error parsing inputs");
                    }
                }
            } catch {
                break;
            }
        }
    }

    /// @notice Test computing function selector from signature
    /// @dev Demonstrates how to compute selector for validation (Task 1.5)
    function test_ComputeFunctionSelector() public pure {
        // Example: owner() function selector
        bytes4 selector = bytes4(keccak256("owner()"));
        console.logBytes4(selector);

        // Example: transferOwnership(address) function selector
        bytes4 transferSelector = bytes4(keccak256("transferOwnership(address)"));
        console.logBytes4(transferSelector);

        // These selectors can be compared with extracted values from ABI
    }
}
