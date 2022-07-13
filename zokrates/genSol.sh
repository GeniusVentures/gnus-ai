# !/bin/bash

../../ZoKrates/target/release/zokrates compile -i SGVerifier.zok -o SGVerifier.zkbin --stdlib-path=../../ZoKrates/zokrates_stdlib/stdlib/

../../ZoKrates/target/release/zokrates compute-witness --abi -i SGVerifier.zkbin -o SGVerifier.witness --stdin <SGVerifier.abi.json

# generate verifier and proving keys
../../ZoKrates/target/release/zokrates setup -i SGVerifier.zkbin -v SGVerifier.key -p SGProving.key

../../ZoKrates/target/release/zokrates export-verifier -i SGVerifier.key -o SGVerifier.sol
