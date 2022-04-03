import { FacetToDeployInfo } from "./common";
import { glob } from "glob";

export const Facets: FacetToDeployInfo = {
    DiamondCutFacet:        { priority: 10},
    DiamondLoupeFacet:      { priority: 20 },
    OwnershipFacet:         { priority: 30 },
    GNUSNFTFactory:         { priority: 40, init: "GNUSNFTFactory_Initialize" },
    PolyGNUSBridge:         { priority: 50, init: "PolyGNUSBridge_Initialize" },
    EscrowAIJob:            { priority: 60, init: "EscrowAIJob_Initialize" },
    GeniusAI:               { priority: 70, init: "GeniusAI_Initialize" },
    GNUSNFTCollectionName:  { priority: 80 },
};

export async function LoadFacetDeployments() {
    const imports = glob.sync(`${__dirname}/facetdeployments/*.ts`);
    for (const file of imports) {
        const deployLoad = file.replace(__dirname, ".").replace(".ts", "");
        await import(deployLoad);
    }
};
