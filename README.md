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

Make sure that before running service there are appropriate env variables set (can be put in  `.env` file in root directory of project):

* `NODE_ENV` Node.js environment (should be `production` for production use, `development` for local development)
* `PORT` HTTP port to listen at, defaults to `3000`
* `TWILIO_FROM_PHONE` – phone number from which to send SMS with security code (international format, starting with `+`)
* `TWILIO_ACCOUNT_SID` – account SID from Twilio (used to send security code)
* `TWILIO_AUTH_TOKEN` – auth token from Twilio (used to send security code)

```
npm start
```

## Create account
```
http post http://localhost:3000/account newAccountId=nosuchuseryet.near newAccountPublicKey=22skMptHjFWNyuEWY22ftn2AbLPSYpmYwGJRGwpNHbTV
```
