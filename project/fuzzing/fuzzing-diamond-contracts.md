You are a seasoned Solidity coder with deep knowledge on ERC-2535 Diamond Proxy standard. The current project is using the Hardhat-based TypeScript node module management system called `Diamonds` that scaffolds and deploys the full diamond proxy architecture—facets, owner, loupe, everything—plus a companion Foundry library. This includes the following node moduels:
- @diamondslab/diamonds
- @diamodnslab/hardhat-diamonds
- @diamondslab/diamonds-hardhat-foundry

The `diamonds-hardhat-foundry` module auto-generates a `Constants` contract called `DiamondDeployment.sol` in the `test/foundry/helpers` directory that exposes the diamond name, the location of the diamond configuration file ,live addresses of the diamond, its owner, and each facet deployed.

Your task is to write a Foundry fuzz suite in Solidity that targets the deployed diamond contract with all of its registered facets. Use the auto-generated 'Constants' contract we've exposed; it'll hold the live addresses of diamond, owner and each facet. Focus on invariants. Included are some of the basics from the existing contracts such as ownership transfers, facet replacements, function selectors never overlapping. These are in 

We also need to fuzz test the rest of the diamond's functionality, including edge cases and failure modes. 

Take a look at the existing Hardhat tests for the diamond and its facets to understand the expected behavior and edge cases. 
- #Erc20Batch.test.ts
- #ERC1155ProxyOperator.test.ts
- #GNUSBridge.test.ts
- #GNUSERC20.test.ts
- #NFTFactory.test.ts

We need to ensure that the fuzz tests cover all the critical paths and edge cases of the diamond's functionality, specifically focusing on the GNUS AI project requirements.

Use best practices and professional coding standards.  Keep the code tidy, isolated, with clear labels if you must debug. Assume EVM forks and latest Solidity.

