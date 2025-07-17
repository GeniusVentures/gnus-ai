/**
 * @file GeniusDiamondDeploymentSuite.test.ts
 * @description This file contains a test suite that runs the comparison test to check
 * pre-deployment consistency before the Genius Diamond deployment, then runs it again
 * post-deployment to verify the data "on-chain" matches the correct values.
 *
 * This suite is designed to be run as a stand-alone.  Running it with other tests that
 * deploy the test will not properly check the pre-deployment data.
 *
 * @author Am0rfu5
 * @date 2025
 * @license MIT
 * Copyright (c) 2025 GNUS.ai
 */
describe('Genius Diamond Deployment Suite', function () {
  // Run the GeniusDiamondDeploymentComparison tests first
  describe('Genius Diamond Deployment Comparison Tests', function () {
    require('./GeniusDiamondPreDeploymentComparison.test');
    require('./GeniusDiamondDeployment.test');
    require('./GeniusDiamondPostDeploymentComparison.test');

  });
});