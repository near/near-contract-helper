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

## Creating contract

```
http post http://localhost:3000/contract nonce:=2 sender:=1 receiver:=10001 contract=`base64 main.wasm`
```
