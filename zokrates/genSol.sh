# !/bin/bash

../../ZoKrates/target/release/zokrates compile --debug -i SGVerifier.zok -o SGVerifier.zkbin --stdlib-path=../../ZoKrates/zokrates_stdlib/stdlib/
retVal=$?
if [ $retVal -ne 0 ]; then
  exit $retVal
fi

# generate universal setup?
# generate verifier and proving keys
#../../ZoKrates/target/release/zokrates universal-setup -u SGUniversalSetup.dat

# generate verifier and proving keys
../../ZoKrates/target/release/zokrates setup -i SGVerifier.zkbin -v SGVerifier.key -p SGProving.key -s gm17 -b ark

../../ZoKrates/target/release/zokrates export-verifier -i SGVerifier.key -o SGVerifier.sol
