import { Contract, ethers } from "ethers";

export enum FacetCutAction {
  Add = 0,
  Replace = 1,
  Remove = 2,
}

export interface FacetInfo {
  facetAddress: string;
  action: FacetCutAction;
  functionSelectors: string[];
}

export class Selectors {
  contract: Contract;
  values: string[] = [];

  constructor(contract: Contract) {
    this.contract = contract;
  }

  // used with getSelectors to remove selectors from an array of selectors
  // functionNames argument is an array of function signatures
  remove(functionNames: string[]): Selectors {
    const newSelectors: Selectors = new Selectors(this.contract);
    newSelectors.values = this.values.filter((v) => {
      for (const functionName of functionNames) {
        if (v === this.contract.interface.getSighash(functionName)) {
          return false;
        }
      }
      return true;
    });
    return newSelectors;
  }

  // used with getSelectors to get selectors from an array of selectors
  // functionNames argument is an array of function signatures
  get(functionNames: string[]): Selectors {
    const newSelectors = new Selectors(this.contract);
    newSelectors.values = this.values.filter((v) => {
      for (const functionName of functionNames) {
        if (v === this.contract.interface.getSighash(functionName)) {
          return true;
        }
      }
      return false;
    });
    return newSelectors;
  }

  // remove selectors using an array of function names
  removeSelectors(signatures: string[]) {
    const iface = new ethers.utils.Interface(
      signatures.map((v) => "function " + v)
    );
    const removeSelectors = signatures.map((v) => iface.getSighash(v));
    this.values = this.values.filter((v) => !removeSelectors.includes(v));
    return this;
  }
}

// get function selectors from ABI
export function getSelectors(
  contract: Contract,
  exclude: Set<string> | null = null
): Selectors {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = new Selectors(contract);
  selectors.values = signatures.reduce<string[]>((acc, val) => {
    const funcSignature = contract.interface.getSighash(val);
    if (!exclude || !exclude.has(funcSignature)) {
      acc.push(funcSignature);
    }
    return acc;
  }, []);
  return selectors;
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
export function findAddressPositionInFacets(
  facetAddress: string,
  facets: FacetInfo[]
) {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i;
    }
  }
}
