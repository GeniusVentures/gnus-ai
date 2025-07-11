import { ContractTransactionResponse } from 'ethers';

export async function logEvents(tx: ContractTransactionResponse) {
  const receipt = await tx.wait();

  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      console.log(`Log: ${JSON.stringify(log)}`);
    }
  }
}
