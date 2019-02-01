# near-contract-helper
Micro-service used by NEARStudio to deploy smart contracts.

## Requirements

1) Install latest Node.js LTS release.
2) Install [HTTPie](http://httpie.org/).

## Install dependencies

```
npm install
```

## Run server

```
node app.js
```

## Create contract

```
http post http://localhost:3000/contract nonce:=2 sender=bob receiver=test contract=`base64 main.wasm`
```

## Call contract method

```
http post http://localhost:3000/contract/test/totalSupply nonce:=2 sender=bob args:="[]"
```

## View account

```
http get http://localhost:3000/account/bob
```

## Create account
```
http post http://localhost:3000/account newAccountId=nosuchuseryet.near newAccountPublicKey=22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV
```
