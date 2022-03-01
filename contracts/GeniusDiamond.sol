// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "contracts-starter/contracts/facets/DiamondLoupeFacet.sol";
import "contracts-starter/contracts/facets/DiamondCutFacet.sol";
import "contracts-starter/contracts/facets/OwnershipFacet.sol";
import "contracts-starter/contracts/upgradeInitializers/DiamondInit.sol";
import "contracts-starter/contracts/Diamond.sol";
import "contracts-starter/contracts/libraries/LibDiamond.sol";

contract GeniusDiamond is Diamond {

    constructor(address _contractOwner, address _diamondCutFacet) payable
        Diamond(_contractOwner, _diamondCutFacet) {
            LibDiamond.setContractOwner(_contractOwner);
        }

        // add Diamond functions here.
    }
