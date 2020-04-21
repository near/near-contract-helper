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

### Environment Variables

Create a `.env` file, copy in the default values from `.env.sample`. Read this file for information about how to change configuration settings to suit your needs.

By default, it assumes that you're running a local node and local network. To do this:

* clone [nearcore]
* in your nearcore directory, get a local network running (at the time of writing, the command was `./scripts/start_localnet.py`)

Note that you need to add an `ACCOUNT_CREATOR_KEY` to your `.env`. Running `nearcore` locally created a `~/.near/validator_key.json` file for you. Copy the contents of this file and paste them as a single line for the `*_KEY` value in your `.env`.

### Run server

    yarn start

### Create account

    http post http://localhost:3000/account newAccountId=nosuchuseryet newAccountPublicKey=22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV


## Running tests

### Create database

Follow the instructions above for creating the development database and `helper` user. Then create an `accounts_test` database using `psql`:

    create database accounts_test with owner=helper;

### Ensure [nearcore] is running

As mentioned in the "Environment Variables" section above, make sure you are running a local blockchain

### Run `yarn test`

This will run the tests using [jest]


  [nearcore]: https://github.com/nearprotocol/nearcore
  [jest]: https://jestjs.io/
