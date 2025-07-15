import { expect } from 'chai';
import { rmSync, existsSync, readFileSync } from 'fs';
import { generateDiamondAbiWithTypechain } from '../../scripts/generate-diamond-abi-with-typechain';
import { Interface } from 'ethers';
import { DiamondAbiGenerationOptions } from '../../scripts/diamond-abi-generator';
import { join } from 'path';

describe('Diamond ABI Integration Tests', () => {
  const testOutputDir = './test-output/diamond-abi';
  const diamondName = 'GeniusDiamond';

  beforeEach(() => {
    // Clean up any existing test output
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test output
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Diamond ABI Generation', () => {
    it('should generate complete diamond ABI and TypeChain types', async function() {
      this.timeout(60000); // Increase timeout for full compilation

      const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: true,
        diamondsPath: './diamonds'
      };
      
      try {
        const result = await generateDiamondAbiWithTypechain(options);

        // Verify the basic result structure
        expect(result).to.have.property('abi');
        expect(result).to.have.property('stats');
        expect(result).to.have.property('outputPath');

        // Verify we have functions in the ABI
        expect(result.stats.totalFunctions).to.be.greaterThan(0);
        
        // Verify the output file exists
        expect(existsSync(result.outputPath!)).to.be.true;

        console.log(`Generated diamond ABI with ${result.stats.totalFunctions} functions from ${result.stats.facetCount} facets`);
      } catch (error) {
        console.error('Integration test failed:', error);
        throw error;
      }
    });

    it('should generate valid Ethereum ABI that can be parsed by ethers', async function() {
      this.timeout(60000);
      
      const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: true,
        diamondsPath: './diamonds'
      };

      const result = await generateDiamondAbiWithTypechain(options);

      // Try to create an Interface from the generated ABI
      expect(() => {
        const iface = new Interface(result.abi);
        expect(iface.fragments.length).to.be.greaterThan(0);
      }).to.not.throw();
    });

    it('should include key diamond functionality in generated ABI', async function() {
      this.timeout(60000);
      const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: true,
        diamondsPath: './diamonds'
      };
      
      const result = await generateDiamondAbiWithTypechain(options);

      // Create interface to check for functions
      const iface = new Interface(result.abi);
      
      // Check for some essential functions that should be in GeniusDiamond
      const expectedFunctions = [
        'supportsInterface', // ERC165/DiamondLoupe
      ];

      const availableFunctions = iface.fragments
        .filter(f => f.type === 'function')
        .map(f => (f as any).name);
      
      for (const funcName of expectedFunctions) {
        const hasFunction = availableFunctions.some(sig => sig.startsWith(funcName));
        expect(hasFunction, `Missing expected function: ${funcName}`).to.be.true;
      }

      console.log(`Available functions: ${availableFunctions.length}`);
      console.log(`Sample functions: ${availableFunctions.slice(0, 5).join(', ')}`);
    });

    it('should generate TypeChain types that can be imported', async function() {
      this.timeout(60000);
      
      const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: true,
        diamondsPath: './diamonds'
      };
      
      const result = await generateDiamondAbiWithTypechain(options);

      // Check if TypeChain generated the diamond types
      const expectedTypeFiles = [
        'diamond-typechain-types/GeniusDiamond.ts',
        'diamond-typechain-types/index.ts',
        'diamond-typechain-types/common.ts'
      ];

      for (const typeFile of expectedTypeFiles) {
        expect(existsSync(typeFile), `Missing TypeChain file: ${typeFile}`).to.be.true;
      }

      // Verify the main diamond type file contains expected content
      const mainTypeFile = 'diamond-typechain-types/GeniusDiamond.ts';
      if (existsSync(mainTypeFile)) {
        const content = readFileSync(mainTypeFile, 'utf8');
        
        // Should contain TypeScript interface definition
        expect(content).to.include('export interface');
        expect(content).to.include('GeniusDiamond');
        expect(content).to.include('ethers');
      }
    });

    it('should handle large diamond with many facets efficiently', async function() {
      this.timeout(90000); // Extra time for large diamond
      
      const startTime = Date.now();
      
const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: true,
        diamondsPath: './diamonds'
      };
      
      const result = await generateDiamondAbiWithTypechain(options);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Generation took ${duration}ms for ${result.stats.facetCount} facets`);
      
      // Should complete within reasonable time (adjust based on your hardware)
      expect(duration).to.be.lessThan(60000); // 60 seconds max
      
      // Should have reasonable number of functions
      expect(result.stats.totalFunctions).to.be.greaterThan(5);
    });

    it('should generate consistent output on multiple runs', async function() {
      this.timeout(90000);
      const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: false,
        diamondsPath: './diamonds'
      };
      
      // Generate ABI twice
      const result1 = await generateDiamondAbiWithTypechain(options);
      const result2 = await generateDiamondAbiWithTypechain(options);

      // Results should be identical
      expect(result1.stats.totalFunctions).to.equal(result2.stats.totalFunctions);
      expect(result1.stats.totalEvents).to.equal(result2.stats.totalEvents);
      expect(result1.stats.facetCount).to.equal(result2.stats.facetCount);
      
      // ABI arrays should have same length
      expect(result1.abi.length).to.equal(result2.abi.length);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle missing diamond configuration gracefully', async function() {
      this.timeout(30000);
      // Generate the diamond ABI using the refactored generator
      // Use diamond-abi directory instead of artifacts/diamond-abi to avoid hardhat conflicts
      const outputDir = join(process.cwd(), 'diamond-abi');
      const options: DiamondAbiGenerationOptions = {
        diamondName: 'NonExistentDiamond',
        verbose: true,
        outputDir,
        validateSelectors: true,
        includeSourceInfo: true,
        diamondsPath: './diamonds'
      };
      
      // Should not crash even with invalid diamond name
      const result = await generateDiamondAbiWithTypechain(options);
      
      expect(result).to.have.property('abi');
      expect(result.abi).to.be.an('array');
    });

    it('should validate generated ABI structure', async function() {
      this.timeout(60000);
      
const options: DiamondAbiGenerationOptions = {
        diamondName: diamondName,
        verbose: false,
        diamondsPath: './diamonds'
      };
      

      const result = await generateDiamondAbiWithTypechain(options);
      
      // Validate ABI structure
      for (const abiItem of result.abi) {
        expect(abiItem).to.have.property('type');
        expect(['function', 'event', 'error', 'constructor']).to.include(abiItem.type);
        
        if (abiItem.type === 'function') {
          expect(abiItem).to.have.property('name');
          expect(abiItem).to.have.property('inputs');
          expect(abiItem).to.have.property('outputs');
          expect(abiItem).to.have.property('stateMutability');
          
          expect(abiItem.inputs).to.be.an('array');
          expect(abiItem.outputs).to.be.an('array');
        }
        
        if (abiItem.type === 'event') {
          expect(abiItem).to.have.property('name');
          expect(abiItem).to.have.property('inputs');
          
          expect(abiItem.inputs).to.be.an('array');
        }
      }
    });
  });
});
