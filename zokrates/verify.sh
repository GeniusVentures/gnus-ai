#! /bin/bash

# generate/compute witness file for inputs
../../ZoKrates/target/release/zokrates compute-witness --abi -i SGVerifier.zkbin -o SGVerifier.witness --stdin <SGVerifier.abi.json

../../ZoKrates/target/release/zokrates generate-proof -i SGVerifier.zkbin -p SGProving.key -w SGVerifier.witness -j SGProof.json -s gm17 -b ark

../../ZoKrates/target/release/zokrates verify -v SGVerifier.key -j SGProof.json -b ark

