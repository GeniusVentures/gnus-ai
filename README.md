# payment channel contracts with genius token

* [Overview](#overview)
* [Solidity Version](#solidity-version)
* [Test and Deploy Locally](#test-and-deploy-locally)

## Overview
Payment channel is a generalized payment network that supports efficient off-chain token transfer with the genius token on on-chain ethereum. 

## Solidity Version
Solidity `^0.5.1` or above is required to run payment channel contracts.

## Test And Deploy Locally
1. Install node v15: [https://nodejs.org](https://nodejs.org).
2. Go to pay-channel-eth's root directory. 
3. Install the node dependencies in the local node_modules folder. 
<pre>
npm install
</pre> 
4. Install truffle and ganache-cli (`sudo` permission might be needed). 
<pre>
npm install -g truffle ganache-cli
</pre>

## Command Line oOly 

---
5. Run ganache-cli
```
ganache-cli -l 8000000
```
6. Use truffle to run tests pay-channel-eth contracts.
```
truffle test
```


## Alternative Using Ganache

---
5. Install [Ganache one-click Ethereum](https://www.trufflesuite.com/ganache)

6. Compile ethereum .sol contract files
```
truffle compile
```

7. Deploy contracts to local ganache blockchain
```
truffle --network ganache migrate
```


