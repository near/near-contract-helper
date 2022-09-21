# near-contract-helper

Microservice used to create NEAR accounts

## Local Development

### Requirements

Install latest Node.js LTS release

### Install dependencies

    yarn

### Environment Variables

Create a `.env` file, copy in the default values from `.env.sample`. Read this file for information about how to change configuration settings to suit your needs.

By default, it assumes that you're running a local node and local network. To do this, use [nearup](https://github.com/near/nearup) or [rainbow-bridge-cli](https://github.com/near/rainbow-bridge-cli)

Now you can add an `ACCOUNT_CREATOR_KEY` to your `.env`. Running a local NEAR network created a `~/.near/localnet/node0/validator_key.json` file for you. Copy the contents of this file and paste them as a single line, with NO whitespace, for the `ACCOUNT_CREATOR_KEY` value in your `.env`. For example:

    ACCOUNT_CREATOR_KEY={"account_id":"node0","public_key":"...","secret_key":"..."}

### Run server with local DynamoDB

    yarn start

### Create account (works only on test networks)

    curl -H "Content-Type: application/json" -XPOST http://0.0.0.0:3000/account --data '{"newAccountId": "nosuchuseryet", "newAccountPublicKey": "22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV"}

### Lookup account by public key

    curl -XGET http://0.0.0.0:3000/publicKey/ed25519:EKveJ28ocxfHXQEfH42AowPL7HgXHkKp3kmMoSXNjiRF/accounts
    curl -XGET https://helper.mainnet.near.org/publicKey/ed25519:EKveJ28ocxfHXQEfH42AowPL7HgXHkKp3kmMoSXNjiRF/accounts

#### Sample response
    
    [
        "heyheyhey.near"
    ]


## Running tests

### Create database

Follow the instructions above for creating the development database and `helper` user. Then create an `accounts_test` database using `psql`:

    create database accounts_test with owner=helper;

### Ensure NEAR localnet is running

As mentioned in the "Environment Variables" section above, make sure you are running a local blockchain

### Run `yarn test`

This will run the tests using [mocha].
Assertions are written using [chai] with [chai-as-promised] for async assertions.
Spies and fake timers provided with [sinon].

[mocha]: https://mochajs.org/
[chai]: https://www.chaijs.com/
[chai-as-promised]: https://www.chaijs.com/plugins/chai-as-promised/
[sinon]: https://sinonjs.org/
