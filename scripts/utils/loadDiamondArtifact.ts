import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import { Diamond } from 'diamonds';

/**
 * Loads a Diamond contract instance using the generated Diamond ABI.
 * This function handles the process of making the Diamond ABI available to Hardhat
 * by copying it to the artifacts directory structure.
 */
export async function loadDiamondContract<T>(
  diamond: Diamond,
  contractAddress: string
): Promise<T> {
  const diamondAbiFilePath = diamond.getDiamondAbiFilePath();

  if (!fs.existsSync(diamondAbiFilePath)) {
    throw new Error(`Diamond ABI artifact not found at ${diamondAbiFilePath}`);
  }

  // Read the Diamond ABI artifact
  const diamondAbiArtifact = JSON.parse(fs.readFileSync(diamondAbiFilePath, 'utf8'));
  
  // Ensure we have a valid ABI
  if (!diamondAbiArtifact.abi || !Array.isArray(diamondAbiArtifact.abi)) {
    throw new Error(`Invalid Diamond ABI artifact at ${diamondAbiFilePath}`);
  }

  // Create the artifacts directory structure for the Diamond contract
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'diamond-abi');
  const artifactPath = path.join(artifactsDir, `${diamond.diamondName}.sol`);
  const finalArtifactPath = path.join(artifactPath, `${diamond.diamondName}.json`);

  // Ensure the directory structure exists
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(artifactPath, { recursive: true });

  // Create a proper Hardhat artifact structure
  const hardhatArtifact = {
    _format: "hh-sol-artifact-1",
    contractName: diamond.diamondName,
    sourceName: `diamond-abi/${diamond.diamondName}.sol`,
    abi: diamondAbiArtifact.abi,
    bytecode: diamondAbiArtifact.bytecode || "0x",
    deployedBytecode: diamondAbiArtifact.deployedBytecode || "0x",
    linkReferences: diamondAbiArtifact.linkReferences || {},
    deployedLinkReferences: diamondAbiArtifact.deployedLinkReferences || {}
  };

  // Write the artifact to the artifacts directory
  fs.writeFileSync(finalArtifactPath, JSON.stringify(hardhatArtifact, null, 2));

  // Now we can use the standard ethers.getContractAt method
  const contractName = `diamond-abi/${diamond.diamondName}.sol:${diamond.diamondName}`;
  
  try {
    return await ethers.getContractAt(contractName, contractAddress) as T;
  } catch (error) {
    // If the above fails, try a simpler approach
    console.warn(`Failed to load with full path, trying alternative: ${error}`);
    try {
      // Try using the contractName directly
      return await ethers.getContractAt(diamond.diamondName, contractAddress) as T;
    } catch (secondError) {
      console.warn(`Failed to load with contract name, using direct ABI approach: ${secondError}`);
      // Final fallback: create contract instance directly
      return createDiamondContract<T>(diamond, contractAddress);
    }
  }
}

/**
 * Alternative method: Create contract instance directly from ABI
 * This avoids the Hardhat artifact system entirely
 */
export async function createDiamondContract<T>(
  diamond: Diamond,
  contractAddress: string,
  signerOrProvider?: any
): Promise<T> {
  const diamondAbiFilePath = diamond.getDiamondAbiFilePath();
  
  if (!fs.existsSync(diamondAbiFilePath)) {
    throw new Error(`Diamond ABI artifact not found at ${diamondAbiFilePath}`);
  }

  // Read the Diamond ABI artifact
  const diamondAbiArtifact = JSON.parse(fs.readFileSync(diamondAbiFilePath, 'utf8'));
  
  // Ensure we have a valid ABI
  if (!diamondAbiArtifact.abi || !Array.isArray(diamondAbiArtifact.abi)) {
    throw new Error(`Invalid Diamond ABI artifact at ${diamondAbiFilePath}`);
  }

  // Create contract instance directly with ethers
  const provider = signerOrProvider || ethers.provider;
  
  return new ethers.Contract(
    contractAddress,
    diamondAbiArtifact.abi,
    provider
  ) as T;
}
