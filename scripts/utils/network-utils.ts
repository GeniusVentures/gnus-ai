import { JsonRpcProvider } from "ethers";

/**
 * Waits for the network to be available by polling the JSON-RPC endpoint.
 * @param url - The JSON-RPC endpoint URL.
 * @param timeout - Maximum time to wait in milliseconds.
 * @returns A promise that resolves when the network is ready or rejects on timeout.
 */
async function waitForNetwork(url: string, timeout: number = 30000): Promise<void> {
  const provider = new JsonRpcProvider(url);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await provider.getBlockNumber(); // Check if the network is responding
      console.log(`Network at ${url} is ready.`);
      return;
    } catch (error) {
      console.log(`Waiting for network at ${url}...`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
    }
  }

  throw new Error(`Network at ${url} did not respond within ${timeout}ms.`);
}

export { waitForNetwork };