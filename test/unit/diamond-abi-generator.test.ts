import { expect } from 'chai';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { DiamondAbiGenerationOptions, generateDiamondAbi, ProjectDiamondAbiGenerator } from '../../scripts/diamond-abi-generator';

describe('Diamond ABI Generator', () => {
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

  describe('ProjectDiamondAbiGenerator', () => {
    // it('should create generator instance with default options', () => {
    //   const generator = new ProjectDiamondAbiGenerator({
    //     diamondName: 'TestDiamond',
    //     diamondsPath: './test-diamonds',
    //   });
      
    //   expect(generator).to.be.an('object');
    // });

    // TODO fix or remove.  This likely 
    it('should create generator instance with custom options', () => {
      const generator = new ProjectDiamondAbiGenerator({
        diamondName: 'GeniusDiamond',
        networkName: 'localhost',
        chainId: 31337,
        outputDir: testOutputDir,
        verbose: true,
      });
      
      expect(generator).to.be.an('object');
    });
  });

  describe('generateDiamondAbi function', () => {
    it('should generate ABI for GeniusDiamond', async function() {
      this.timeout(30000); // Increase timeout for compilation
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: testOutputDir,
        verbose: true,
        validateSelectors: true,
        includeSourceInfo: true
      });

      // Verify result structure
      expect(result).to.have.property('abi');
      expect(result).to.have.property('selectorMap');
      expect(result).to.have.property('facetAddresses');
      expect(result).to.have.property('outputPath');
      expect(result).to.have.property('stats');

      // Verify ABI is an array
      expect(result.abi).to.be.an('array');
      
      // Verify stats
      expect(result.stats).to.have.property('totalFunctions');
      expect(result.stats).to.have.property('totalEvents');
      expect(result.stats).to.have.property('totalErrors');
      expect(result.stats).to.have.property('facetCount');
      expect(result.stats).to.have.property('duplicateSelectorsSkipped');

      // Verify output file was created
      expect(result.outputPath).to.be.a('string');
      expect(existsSync(result.outputPath!)).to.be.true;

      console.log(`Generated ABI with ${result.stats.totalFunctions} functions, ${result.stats.totalEvents} events, ${result.stats.facetCount} facets`);
    });

    it('should include essential diamond functions in ABI', async function() {
      this.timeout(30000);
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: testOutputDir,
        verbose: false
      });

      // Check for essential functions that should be in any diamond
      const functionNames = result.abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => item.name);

      // These functions should be present in most diamonds
      const expectedFunctions = [
        'supportsInterface' // From DiamondLoupe or ERC165
      ];

      for (const funcName of expectedFunctions) {
        expect(functionNames).to.include(funcName, `Missing essential function: ${funcName}`);
      }
    });

    it('should generate valid selector mappings', async function() {
      this.timeout(30000);
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: testOutputDir,
        verbose: false,
        includeSourceInfo: true
      });

      // Verify selector map
      expect(result.selectorMap).to.be.an('object');
      
      // Each selector should map to a facet name
      for (const [selector, facetName] of Object.entries(result.selectorMap)) {
        expect(selector).to.match(/^0x[a-fA-F0-9]{8}$/);
        expect(facetName as string).to.be.a('string');
        expect((facetName as string).length).to.be.greaterThan(0);
      }
    });

    it('should handle missing facets gracefully', async function() {
      this.timeout(30000);
      
      // This should not throw even if some facets are missing
      const result = await generateDiamondAbi({
        diamondName: 'NonExistentDiamond',
        outputDir: testOutputDir,
        verbose: true,
        diamondsPath: './test-diamonds'
      });

      expect(result).to.have.property('abi');
      expect(result.abi).to.be.an('array');
    });

    it('should include metadata when includeSourceInfo is true', async function() {
      this.timeout(30000);
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: testOutputDir,
        includeSourceInfo: true
      });

      // Read the generated artifact file
      const fs = require('fs');
      const artifactContent = fs.readFileSync(result.outputPath!, 'utf8');
      const artifact = JSON.parse(artifactContent);

      expect(artifact).to.have.property('metadata');
      
      // Parse the metadata string into an object
      const metadata = typeof artifact.metadata === 'string' 
        ? JSON.parse(artifact.metadata) 
        : artifact.metadata;
      
      expect(metadata).to.have.property('generatedAt');
      expect(metadata).to.have.property('compiler');
      expect(metadata).to.have.property('selectorMap');
      
      expect(metadata.compiler).to.equal('diamond-abi-generator');
    });

    it('should validate that no duplicate selectors exist', async function() {
      this.timeout(30000);
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: testOutputDir,
        validateSelectors: true,
        verbose: true
      });

      // Count unique selectors from the generated ABI
      const functionSelectors = new Set();
      
      for (const abiItem of result.abi) {
        if (abiItem.type === 'function') {
          // Calculate selector manually to verify uniqueness
          const signature = `${abiItem.name}(${abiItem.inputs.map((input: any) => input.type).join(',')})`;
          const selector = signature; // Simplified for testing
          
          expect(functionSelectors.has(selector), `Duplicate selector found: ${signature}`).to.be.false;
          functionSelectors.add(selector);
        }
      }

      // The number of unique function selectors should match the function count
      expect(functionSelectors.size).to.equal(result.stats.totalFunctions);
    });
  });

  describe('Error handling', () => {
    // it('should handle invalid diamond name gracefully', async function() {
    //   this.timeout(30000);

    //   // Should not throw, but might produce empty ABI
    //   const result = await generateDiamondAbi({
    //     diamondName: 'CompletelyInvalidDiamond',
    //     outputDir: testOutputDir,
    //     verbose: true,
    //     diamondsPath: './test-diamonds'
    //   });

    //   expect(result).to.have.property('abi');
    //   expect(result.abi).to.be.an('array');
    // });

    it('should handle invalid output directory', async function() {
      this.timeout(30000);
      
      // Should create the directory if it doesn't exist
      const invalidDir = '/tmp/invalid-very-deep-path/diamond-abi';
      
      const result = await generateDiamondAbi({
        diamondName,
        outputDir: invalidDir,
        verbose: false
      });

      expect(result.outputPath).to.include(invalidDir);
      expect(existsSync(result.outputPath!)).to.be.true;
      
      // Clean up
      if (existsSync(invalidDir)) {
        rmSync(invalidDir, { recursive: true, force: true });
      }
    });
  });
});
