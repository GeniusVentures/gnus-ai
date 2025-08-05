#!/usr/bin/env npx ts-node

/**
 * Verification script for deployed diamond
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const diamondAddress = "0xB44476E2aFBe1D10F6FE9ca11B23e200033c56f7";
  const networkName = process.argv[2] || 'sepolia';
  
  console.log("🔍 Verifying Diamond deployment...");
  console.log(`📍 Diamond Address: ${diamondAddress}`);
  console.log(`🌐 Network: ${networkName}`);
  
  // Set up provider and network
  const rpcUrl = process.env.SEPOLIA_RPC;
  if (!rpcUrl) {
    throw new Error('SEPOLIA_RPC not set in environment variables');
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  console.log(`🔗 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
  
  // DiamondLoupe ABI for basic diamond inspection
  const diamondLoupeABI = [
    "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])",
    "function facetFunctionSelectors(address facet) external view returns (bytes4[])",
    "function facetAddresses() external view returns (address[])",
    "function facetAddress(bytes4 selector) external view returns (address)",
    "function supportsInterface(bytes4 interfaceId) external view returns (bool)"
  ];
  
  // Get the diamond contract using DiamondLoupe interface
  const diamondLoupeFacet = new ethers.Contract(diamondAddress, diamondLoupeABI, provider);
  
  try {
    // Get all facets
    const facets = await diamondLoupeFacet.facets();
    console.log(`\n✅ Diamond has ${facets.length} facets:`);
    
    let totalSelectors = 0;
    for (let i = 0; i < facets.length; i++) {
      const facet = facets[i];
      const selectorCount = facet.functionSelectors.length;
      totalSelectors += selectorCount;
      console.log(`   ${i + 1}. ${facet.facetAddress} - ${selectorCount} selectors`);
    }
    
    console.log(`\n📊 Total function selectors: ${totalSelectors}`);
    
    // Test a few specific functions
    console.log("\n🧪 Testing specific functions:");
    
    try {
      // Load the deployed diamond ABI
      const fs = require('fs');
      const path = require('path');
      const diamondAbiPath = path.join(__dirname, '../../diamond-abi/GeniusDiamond.json');
      
      if (fs.existsSync(diamondAbiPath)) {
        const diamondArtifact = JSON.parse(fs.readFileSync(diamondAbiPath, 'utf8'));
        const geniusDiamond = new ethers.Contract(diamondAddress, diamondArtifact.abi, provider);
        
        // Test ERC165 support
        const hasERC165 = await diamondLoupeFacet.supportsInterface("0x01ffc9a7");
        console.log(`   ERC165 Support: ${hasERC165}`);
        
        // Test owner function if available
        try {
          const owner = await geniusDiamond.owner();
          console.log(`   Owner: ${owner}`);
        } catch (ownerError) {
          console.log(`   Owner function not available or failed`);
        }
        
        // Test protocol version if available
        try {
          const protocolVersion = await geniusDiamond.protocolVersion();
          console.log(`   Protocol Version: ${protocolVersion}`);
        } catch (versionError) {
          console.log(`   Protocol version not available`);
        }
        
        console.log("\n🎉 Diamond verification completed successfully!");
        
      } else {
        console.log(`⚠️  Diamond ABI not found at ${diamondAbiPath}`);
        console.log("✅ Basic DiamondLoupe verification completed successfully!");
      }
      
    } catch (funcError) {
      console.log(`⚠️  Some functions may not be available: ${(funcError as Error).message}`);
      console.log("✅ Basic DiamondLoupe verification completed successfully!");
    }
    
  } catch (error) {
    console.error("❌ Diamond verification failed:", (error as Error).message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
