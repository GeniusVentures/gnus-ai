declare module 'contracts-starter/scripts/libraries/diamond' {
  export const FacetCutAction: {
    Add: number;
    Replace: number;
    Remove: number;
  };

  export function getSelectors(contract: any): string[];

  export function getSelector(func: string): string;

  export function remove(functionNames: string[]): string[];
}

declare module 'contracts-starter/contracts/interfaces/IDiamondCut' {
  export type FacetCutStruct = {
    facetAddress: AddressLike;
    action: BigNumberish;
    functionSelectors: BytesLike[];
  };
}
