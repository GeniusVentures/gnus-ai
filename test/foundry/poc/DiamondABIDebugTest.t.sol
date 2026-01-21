// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

/// @title Simple Diamond ABI Debug Test
/// @notice Simplified test to debug the revert issue
contract DiamondABIDebugTest is Test {
    string constant DIAMOND_ABI_PATH = "./diamond-abi/GeniusDiamond.json";

    function test_CountFunctions() public view {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        uint256 functionCount = 0;
        uint256 totalCount = 0;

        // Parse the entire .abi array to get its length properly
        // This avoids the boundary condition of accessing non-existent indices
        bytes memory abiArrayBytes = vm.parseJson(abiJson, ".abi");

        // The array is ABI-encoded: first word is offset/pointer, skip to get to actual data
        // At the data location, first 32 bytes is the array length
        uint256 arrayLength;
        assembly {
            // abiArrayBytes points to: [length_of_bytes][32_bytes_offset][32_bytes_array_length][...array_data]
            // We want the array length which is at offset 64 (skip 32 for bytes length, 32 for offset pointer)
            arrayLength := mload(add(abiArrayBytes, 64))
        }

        console.log("ABI array length from JSON:", arrayLength);

        // Loop through only the actual array indices (0 to arrayLength-1)
        for (uint256 i = 0; i < arrayLength; i++) {
            string memory indexPath = string(abi.encodePacked(".abi[", vm.toString(i), "]"));
            bytes memory typeBytes = vm.parseJson(
                abiJson,
                string(abi.encodePacked(indexPath, ".type"))
            );

            totalCount++;
            string memory entryType = abi.decode(typeBytes, (string));

            if (keccak256(bytes(entryType)) == keccak256(bytes("function"))) {
                functionCount++;
            }
        }

        console.log("Total ABI entries:", totalCount);
        console.log("Function entries:", functionCount);

        assertTrue(functionCount > 0, "Should have at least one function");
    }

    function test_ExtractFirstFunction() public view {
        string memory abiJson = vm.readFile(DIAMOND_ABI_PATH);

        // Get ABI array length properly
        bytes memory abiArrayBytes = vm.parseJson(abiJson, ".abi");
        uint256 arrayLength;
        assembly {
            arrayLength := mload(add(abiArrayBytes, 64))
        }

        // Find first function and extract its info
        for (uint256 i = 0; i < arrayLength; i++) {
            string memory indexPath = string(abi.encodePacked(".abi[", vm.toString(i), "]"));
            bytes memory typeBytes = vm.parseJson(
                abiJson,
                string(abi.encodePacked(indexPath, ".type"))
            );
            string memory entryType = abi.decode(typeBytes, (string));

            if (keccak256(bytes(entryType)) == keccak256(bytes("function"))) {
                // Found a function - get name
                string memory functionName = abi.decode(
                    vm.parseJson(abiJson, string(abi.encodePacked(indexPath, ".name"))),
                    (string)
                );

                console.log("First function found at index:", i);
                console.log("Function name:", functionName);

                // Build signature
                string memory signature = functionName;
                signature = string(abi.encodePacked(signature, "("));

                // Get inputs array length properly to count parameters
                bytes memory inputsBytes = vm.parseJson(
                    abiJson,
                    string(abi.encodePacked(indexPath, ".inputs"))
                );
                uint256 inputCount;
                assembly {
                    inputCount := mload(add(inputsBytes, 64))
                }

                console.log("Input count:", inputCount);

                // Build parameter list
                for (uint256 j = 0; j < inputCount; j++) {
                    string memory inputPath = string(
                        abi.encodePacked(indexPath, ".inputs[", vm.toString(j), "].type")
                    );
                    string memory paramType = abi.decode(
                        vm.parseJson(abiJson, inputPath),
                        (string)
                    );

                    console.log("  Param", j, ":", paramType);

                    signature = string(abi.encodePacked(signature, paramType));
                    if (j < inputCount - 1) {
                        signature = string(abi.encodePacked(signature, ","));
                    }
                }

                signature = string(abi.encodePacked(signature, ")"));

                console.log("Full signature:", signature);

                bytes4 selector = bytes4(keccak256(bytes(signature)));
                console.log("Selector:");
                console.logBytes4(selector);

                return; // Success - exit test
            }
        }

        assert(false); // Should find at least one function
    }
}
