# near-contract-helper

Microservice used to create NEAR accounts

## Local Development

### Requirements

1) Install latest Node.js LTS release
2) Install [HTTPie](http://httpie.org/)

### Install dependencies

    yarn

### Create database

Make sure you have PostgreSQL installed and running. On macOS, you can use [Postgres.app](https://postgresapp.com/).

Create `accounts_development` Postgres DB with `helper` user/password. You can do this from within `psql` using:

    create user helper with superuser password 'helper';
    create database accounts_development with owner=helper;

After that:

    yarn migrate

You can also modify DB config in `config/config.js` to use different connection settings, etc.

### Adding Migrations

Follow existing migrations as examples. To generate a migration file use the following:
```
npx sequelize-cli migration:generate --name migration-skeleton
```

### Environment Variables

Create a `.env` file, copy in the default values from `.env.sample`. Read this file for information about how to change configuration settings to suit your needs.

By default, it assumes that you're running a local node and local network. To do this, use [nearup](https://github.com/near/nearup) or [rainbow-bridge-cli](https://github.com/near/rainbow-bridge-cli)

Now you can add an `ACCOUNT_CREATOR_KEY` to your `.env`. Running a local NEAR network created a `~/.near/localnet/node0/validator_key.json` file for you. Copy the contents of this file and paste them as a single line, with NO whitespace, for the `ACCOUNT_CREATOR_KEY` value in your `.env`. For example:

    ACCOUNT_CREATOR_KEY={"account_id":"node0","public_key":"...","secret_key":"..."}

### Run server

    yarn start

### Create account (works only on test networks)

    http post http://localhost:3000/account newAccountId=nosuchuseryet newAccountPublicKey=22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV

### Lookup account by public key

    http http://localhost:3000/publicKey/ed25519:EKveJ28ocxfHXQEfH42AowPL7HgXHkKp3kmMoSXNjiRF/accounts
    http https://helper.mainnet.near.org/publicKey/ed25519:EKveJ28ocxfHXQEfH42AowPL7HgXHkKp3kmMoSXNjiRF/accounts

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

This will run the tests using [jest]

Tests should be run sequentially, i.e.
```
jest test --runInBand
```

  [jest]: https://jestjs.io/
