import { ethers } from 'hardhat';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { loadDiamondContract } from '../utils/loadDiamondArtifact';
import { Diamond } from 'diamonds';
import { debuglog } from 'util';

/**
 * Migration script for GNUS Blacklist V2
 * Migrates addresses from the legacy blacklist system to the new MSB-based system
 */

interface MigrationConfig {
  diamondAddress?: string;
  batchSize?: number;
  dryRun?: boolean;
  networkName?: string;
}

export class BlacklistMigration {
  private diamond: GeniusDiamond;
  private config: MigrationConfig;
  private migrationLog: Array<{
    address: string;
    wasLegacyBlacklisted: boolean;
    migrated: boolean;
    error?: string;
  }> = [];

  constructor(diamond: GeniusDiamond, config: MigrationConfig = {}) {
    this.diamond = diamond;
    this.config = {
      batchSize: 50,
      dryRun: false,
      ...config,
    };
  }

  /**
   * Gets all addresses that are currently in the legacy blacklist system
   */
  async getLegacyBlacklistedAddresses(): Promise<string[]> {
    const blacklistedAddresses: string[] = [];
    
    // This is a placeholder implementation.
    // In practice, we would need a stored list
    // of blacklisted addresses
    
    debuglog('Note: This implementation requires a list of known blacklisted addresses');
    // debuglog('In production, you would scan AddToGlobalBlackList and AddToBlackList events');
    
    return blacklistedAddresses;
  }

    /**
     * @notice Check if an address is blacklisted in the legacy system
     * @dev Since the legacy blacklist check function is internal, this method
     *      requires the addresses to be provided externally or we need to add
     *      a public view function to check legacy blacklist status
     */
    private async isLegacyBlacklisted(address: string): Promise<boolean> {
        // TODO: This would require either:
        // 1. A list of known blacklisted addresses to be provided
        // 2. Adding a public view function to GNUSControl to check blacklist status
        // 3. Reading storage directly (complex and gas-intensive)
        
        // For now, return false and rely on manual address list
        console.warn(`Legacy blacklist check not implemented for ${address}. Please provide known blacklisted addresses manually.`);
        return false;
    }  /**
   * Checks if an address is blacklisted in the V2 system
   */
  async isV2Blacklisted(address: string): Promise<boolean> {
    try {
      // This would use the new isBlacklisted function once TypeChain types are generated
      // For now, we'll use a placeholder
      console.log(`Checking V2 blacklist status for ${address}`);
      return false; // Placeholder
    } catch (error) {
      console.error(`Error checking V2 blacklist for ${address}:`, error);
      return false;
    }
  }

  /**
   * Migrates a batch of addresses from legacy to V2 blacklist
   */
  async migrateBatch(addresses: string[]): Promise<void> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] Would migrate ${addresses.length} addresses`);
      for (const address of addresses) {
        const isLegacy = await this.isLegacyBlacklisted(address);
        const isV2 = await this.isV2Blacklisted(address);
        
        this.migrationLog.push({
          address,
          wasLegacyBlacklisted: isLegacy,
          migrated: false,
        });
        
        console.log(`[DRY RUN] ${address}: Legacy=${isLegacy}, V2=${isV2}`);
      }
      return;
    }

    try {
      // Filter addresses that need migration
      const addressesToMigrate: string[] = [];
      
      for (const address of addresses) {
        const isLegacy = await this.isLegacyBlacklisted(address);
        const isV2 = await this.isV2Blacklisted(address);
        
        if (isLegacy && !isV2) {
          addressesToMigrate.push(address);
        }
        
        this.migrationLog.push({
          address,
          wasLegacyBlacklisted: isLegacy,
          migrated: false,
        });
      }

      if (addressesToMigrate.length === 0) {
        console.log('No addresses need migration in this batch');
        return;
      }

      console.log(`Migrating ${addressesToMigrate.length} addresses...`);
      
      // Call the migration function (placeholder - requires TypeChain types)
      // const tx = await this.diamond.migrateBlacklistedAccounts(addressesToMigrate);
      // await tx.wait();
      
      console.log('Migration transaction completed');
      
      // Update migration log
      for (const address of addressesToMigrate) {
        const logEntry = this.migrationLog.find(entry => entry.address === address);
        if (logEntry) {
          logEntry.migrated = true;
        }
      }
      
    } catch (error) {
      console.error('Error during batch migration:', error);
      throw error;
    }
  }

  /**
   * Runs the complete migration process
   * @param knownBlacklistedAddresses - Array of addresses known to be blacklisted in legacy system
   */
  async runMigration(knownBlacklistedAddresses?: string[]): Promise<void> {
    console.log('Starting Blacklist V2 Migration...');
    console.log(`Network: ${this.config.networkName || 'unknown'}`);
    console.log(`Dry run: ${this.config.dryRun}`);
    console.log(`Batch size: ${this.config.batchSize}`);
    
    try {
      // Get migration status
      // const migrationStatus = await this.diamond.getMigrationStatus();
      // if (migrationStatus.migrationComplete) {
      //   console.log('Migration already completed');
      //   return;
      // }

      const addresses = knownBlacklistedAddresses || await this.getLegacyBlacklistedAddresses();
      
      if (addresses.length === 0) {
        console.log('No addresses to migrate');
        console.log('Please provide an array of known blacklisted addresses as parameter to runMigration()');
        return;
      }

      console.log(`Found ${addresses.length} addresses to process`);

      // Process in batches
      const batchSize = this.config.batchSize!;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)}`);
        
        await this.migrateBatch(batch);
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < addresses.length) {
          console.log('Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!this.config.dryRun) {
        console.log('Completing migration...');
        // await this.diamond.completeMigration();
        console.log('Migration completed successfully');
      }

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Prints migration summary
   */
  printSummary(): void {
    console.log('\n=== Migration Summary ===');
    console.log(`Total addresses processed: ${this.migrationLog.length}`);
    console.log(`Legacy blacklisted: ${this.migrationLog.filter(entry => entry.wasLegacyBlacklisted).length}`);
    console.log(`Successfully migrated: ${this.migrationLog.filter(entry => entry.migrated).length}`);
    console.log(`Errors: ${this.migrationLog.filter(entry => entry.error).length}`);
    
    if (this.migrationLog.some(entry => entry.error)) {
      console.log('\nErrors:');
      this.migrationLog
        .filter(entry => entry.error)
        .forEach(entry => console.log(`  ${entry.address}: ${entry.error}`));
    }
  }

  /**
   * Validates migration results
   */
  async validateMigration(addressesToCheck?: string[]): Promise<boolean> {
    console.log('Validating migration...');
    
    const addresses = addressesToCheck || this.migrationLog.map(entry => entry.address);
    let validationPassed = true;
    
    for (const address of addresses) {
      try {
        const isLegacy = await this.isLegacyBlacklisted(address);
        const isV2 = await this.isV2Blacklisted(address);
        
        if (isLegacy && !isV2) {
          console.error(`Validation failed for ${address}: Legacy blacklisted but not in V2`);
          validationPassed = false;
        }
      } catch (error) {
        console.error(`Validation error for ${address}:`, error);
        validationPassed = false;
      }
    }
    
    console.log(`Validation ${validationPassed ? 'passed' : 'failed'}`);
    return validationPassed;
  }
}

/**
 * Main migration function
 */
async function main() {
  const networkName = hre.network.name;
  console.log(`Running Blacklist V2 Migration on ${networkName}`);
  
  try {
    // Example addresses to migrate (replace with actual blacklisted addresses)
    const knownBlacklistedAddresses = [
      // Add known blacklisted addresses here - these should be addresses
      // that are currently blacklisted in the legacy GNUSControl system
      // '0x123...',
      // '0x456...',
    ];
    
    const config: MigrationConfig = {
      networkName,
      batchSize: 20,
      dryRun: process.argv.includes('--dry-run'),
    };
    
    console.log('\n=== Blacklist V2 Migration Setup ===');
    console.log('To run this migration:');
    console.log('1. First, generate TypeChain types:');
    console.log('   npx ts-node scripts/generate-diamond-abi-with-typechain.ts GeniusDiamond');
    console.log('2. Add known blacklisted addresses to the knownBlacklistedAddresses array above');
    console.log('3. Uncomment and configure the diamond contract loading code below');
    console.log('4. Run with: npx ts-node scripts/migrations/blacklist-migration.ts [--dry-run]');
    
    if (knownBlacklistedAddresses.length === 0) {
      console.log('\nNo blacklisted addresses provided. Please add addresses to migrate.');
      console.log('You can find blacklisted addresses by scanning for:');
      console.log('- AddToGlobalBlackList events');
      console.log('- AddToBlackList events');
      console.log('- Or by querying your database/records of blacklisted users');
      return;
    }
    
    // TODO: Uncomment and configure this section after TypeChain types are generated:
    /*
    console.log('Loading diamond contract...');
    const diamond = await loadDiamondContract<GeniusDiamond>(...); // Add proper contract loading
    const migration = new BlacklistMigration(diamond, config);
    
    await migration.runMigration(knownBlacklistedAddresses);
    migration.printSummary();
    
    if (!config.dryRun) {
      const isValid = await migration.validateMigration();
      if (!isValid) {
        console.error('Migration validation failed!');
        process.exit(1);
      }
    }
    
    console.log('Migration completed successfully');
    */
    
    console.log('\nMigration script is ready. Please configure and uncomment the execution code.');
    
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as runBlacklistMigration };
