import hre, { ethers } from 'hardhat';
import debug from 'debug';

const log: debug.Debugger = debug('GNUSGasCost:log');
log.color = '34';

// Function to get the gas price and calculate cost
export async function getGasCost() {
    try {
        // Get the gas price from the network (in wei)
        const gasPrice = await ethers.provider.getGasPrice();

        // Gas limit of 15,000,000 (for your calculation)
        const gasLimit = 15000000;

        // Calculate total gas cost in wei (gas price * gas limit)
        const totalGasCostInWei = gasPrice.mul(gasLimit);

        // Convert the total gas cost from wei to ETH
        const gasCostInEth = ethers.utils.formatUnits(totalGasCostInWei, 'ether');

        log(`For Network ${hre.network.name}`);
        log(`Gas Price (in Wei): ${gasPrice.toString()}`);
        log(`Gas Cost for 15,000,000 gas limit: ${totalGasCostInWei} WEI`);
        log(`Gas Cost for 15,000,000 gas limit: ${gasCostInEth} ETH`);

        return gasCostInEth;
    } catch (error) {
        log('Error fetching gas price:', error);
        throw error;
    }
}

// Main function to allow Yarn or other calls
async function main() {
    if (require.main === module) {
        debug.enable('GNUS.*:log');
        const gasCost = await getGasCost();
        log(`Calculated Gas Cost: ${gasCost}`);
    }
}

// Execute if run directly as Yarn command
if (require.main === module) {
    main().catch((error) => {
        log(error);
        process.exit(1);
    });
}
