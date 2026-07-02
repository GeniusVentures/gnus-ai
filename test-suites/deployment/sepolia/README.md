# Sepolia v2.4 -> 2.5 deployment test suite

## Description

The Sepolia version 2.4 deployment contains some problems that require a specific upgrade path to version 2.5. This test suite is designed to validate the deployment of the Sepolia network from version 2.4 to 2.5. It includes a series of tests that cover various aspects of the deployment process, including configuration, network connectivity, and functionality.

## Running this test suite

> > NOTE: The deployment records need to be reset after each run. This can be done by running the following command:

```bash
git checkout diamonds/GeniusDiamond/deployments/geniusdiamond-v2.4-sepolia-31337.json
git checkout diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155112.json
```

To run the test suite, use the following command:

```bash
yarn test-multichain test-suites/deployment/sepolia/GeniusDiamondDeployment.test.ts --chains sepolia --logs log
```

## Specific Issues and Solutions

- **Issue**: The previous upgrade did not complete properly. This led to a situation where the Diamond has function selectors registered for two different version of the same contract- GeniusAI.
- **Solution**: The upgrade process needs to be modified to ensure that the function selectors are registered correctly. This is done by performing a two stage deployment.
  - **Stage 1**: Remove the function selectors that are registered but not needed for the previous version of the contract. This leaves only the correct version of the contract registered.
  - **Stage 2**: Upgrade the rest of the contract as needed.
