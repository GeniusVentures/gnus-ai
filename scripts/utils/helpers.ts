import { ethers } from 'hardhat';
import { Interface, parseEther, FunctionFragment } from 'ethers';

export function getInterfaceID(contractInterface: Interface) {
  let interfaceID: bigint = 0n;
  const fragments = contractInterface.fragments.filter(f => f.type === 'function') as FunctionFragment[];
  for (const fragment of fragments) {
    interfaceID = interfaceID ^ BigInt(contractInterface.getFunction(fragment.name)!.selector);
  }

  return interfaceID;
}

export function toWei(value: number | string): bigint {
  return parseEther(value.toString());
}
