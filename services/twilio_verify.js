const twilio = require('twilio');
const password = require('secure-random-password');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const USE_MOCK_TWILIO = process.env.USE_MOCK_TWILIO === 'true';

const VERIFY_DELIVERY_CHANNEL = 'sms';

class MockTwilioVerifyService {
    securityCodes = {};

    send({ to }, emitServerEvent) {
        const securityCode = password.randomPassword({ length: 6, characters: password.digits });

        this.securityCodes[to] = securityCode;
        emitServerEvent(securityCode);
    }

    verify({ to, code }) {
        return code === this.securityCodes[to];
    }
}

class TwilioVerifyService {
    constructor() {
        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    send({ to }) {
        return this.verifyService.verifications.create({ to, channel: VERIFY_DELIVERY_CHANNEL });
    }

    async verify({ to, code }) {
        const { valid } = await this.verifyService.verificationChecks.create({ to, code });
        return valid;
    }
}

module.exports = USE_MOCK_TWILIO ? MockTwilioVerifyService : TwilioVerifyService;
