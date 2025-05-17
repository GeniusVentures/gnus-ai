# GNUS.ai Tests

>> This directory contains the tests for the GNUS.ai project.

## Test Structure

The tests are organized into directories based on the functionality being tested. Generally, each file contains a test for a contract or a specific feature of the GNUS.ai project.

The tests are written in Typescript and use Hardhat, Mocha, Chai, Waffle, Ethers, and Typechain for testing smart contracts. The tests are designed to be run in a local Hardhat network using the Hardhat Multichain module although they can also be run without it.

## Running Tests

To simply run all tests in the test directory using the following command (which is aliased to `yarn test-multichain`):

```bash
yarn test
```

To run a specific test file, use the following command:

```bash
yarn test test/<test_file_name>.ts
```

To run a specific test file with a specific network, use the following command:

```bash
yarn test test/<test_file_name>.ts --chains <networks-list-comma-separated>
```

To run tests with blockchain logs being written to files use the following command:

```bash
yarn test test/<test_file_name>.ts --log <log_directory>
```

## Test structure

The test files contain a bit of boilerplate code to set up the test environment. The following is a brief overview of the structure that is consistent across each test file:

- **Tests**: The test file contains the actual tests, which are organized into nested `describe` blocks to handle multiple networks. Each test is defined using the `it` function, and assertions are made using Chai's `expect` or `assert` functions.
- **Imports**: The test file imports the necessary libraries and modules, including Hardhat, Mocha, Chai, Waffle, Ethers, Typechain, and any other dependencies required for the tests. Many of these are standard across all test files.
- **Network Configuration**: The test file sets up the network configuration using hardhat-multichain and some configuration included in the `hardhat.config.ts`. It also configures for the Hardhat network if no other network is specified. Each network is looped through for each test.
- **Deployments**: The test file deploys the necessary contracts using the `diamonds` module, with configuration and deployment records in the `diamonds/GeniusDiamond` directory. Deployments (or upgrades) are only done once per network using a Multiton pattern.s
- **Setup**: The test file sets up the most commonly used variable used in tests like accounts and Signed Diamond contracts. This is done using the `before` hooks provided by `Mocha`.
- **Isolation**: The test file uses `beforeEach` hooks to ensure that each test runs in isolation. This is important for ensuring that tests do not interfere with each other and that the results are consistent.
- **Assertions**: The test file uses Chai's `expect` or `assert` functions to make assertions about the expected behavior of the contracts being tested. This includes checking the state of the contracts, the values returned by functions, and any events emitted by the contracts.