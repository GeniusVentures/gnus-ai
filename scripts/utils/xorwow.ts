import { debug } from 'debug';
import * as uint32 from 'uint32';

const log: debug.Debugger = debug('xorwow:log');
log.color = '141';

// this is the main ZKSnark code that checks the validity of processed nodes.
// Based on 11 total nodes, 10 micro processed blocks at a time for each node.
// The verfier node has 10 processed blocks also
// which are 1 each of the other nodes.  The Hash of the previous block xor this
export interface XORWOW_STATE {
  x: Uint32Array;
  counter: number;
}

export function xorwow(state: XORWOW_STATE): number {
  /* Algorithm "xorwow" from p. 5 of Marsaglia, "Xorshift RNGs" */
  let t: number = state.x[4];
  const s: number = state.x[0];
  state.x[4] = state.x[3];
  state.x[3] = state.x[2];
  state.x[2] = state.x[1];
  state.x[1] = s;

  t = uint32.xor(t, uint32.shiftRight(t, 2));
  t = uint32.xor(t, uint32.shiftLeft(t, 1));
  t = uint32.xor(t, uint32.xor(s, uint32.shiftLeft(s, 4)));

  state.x[0] = uint32.toUint32(t);
  state.counter = uint32.addMod32(state.counter, 362437);
  return uint32.addMod32(t, state.counter);
}
