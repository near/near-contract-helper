# near-contract-helper
Micro-service used to create accounts.

## Environment Variables
This micro-service depends on the following environment variables:
* `NODE_URL` -- default `https://studio.nearprotocol.com/devnet`;
* `PORT` -- default `3000`;

The above variable is used internally by the contract helper, it does not have to correspond to the external IP or DNS
name and can link to the host machine running the Docker container.

* `NODE_ENV` -- default `production`. Node.js environment (should be `production` for production use, `development` for local development)
* `NEW_ACCOUNT_AMOUNT` -- default `10000000000`, integer;
* `ACCOUNT_CREATOR_KEY` -- JSON key of account used to create accounts
* `ACCOUNT_RECOVERY_KEY` -- JSON key of  account used to recover accounts
* `TWILIO_FROM_PHONE` – phone number from which to send SMS with security code (international format, starting with `+`)
* `TWILIO_ACCOUNT_SID` – account SID from Twilio (used to send security code)
* `TWILIO_AUTH_TOKEN` – auth token from Twilio (used to send security code)

## Local Development

### Requirements

1) Install latest Node.js LTS release.
2) Install [HTTPie](http://httpie.org/).

### Install dependencies

```
npm install
```

### Create database

Create `accounts_development` Postgres DB with `fiddle` user/password.
After that:

```
npm run migrate
```

You can also modify DB config in `config/config.json` to use different connection settings, etc.

### Run server

Make sure that before running service there are appropriate env variables set (can be put in  `.env` file in root directory of project):

```
npm start
```

### Create account
```
http post http://localhost:3000/account newAccountId=nosuchuseryet.near newAccountPublicKey=22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV
```
