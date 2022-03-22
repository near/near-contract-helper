const twilio = require('twilio');
const password = require('secure-random-password');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const USE_MOCK_TWILIO = process.env.USE_MOCK_TWILIO === 'true';

const VERIFY_DELIVERY_CHANNEL = 'sms';

module.exports = class TwilioVerifyService {
    securityCodes = {};

    constructor() {
        if (USE_MOCK_TWILIO) {
            return;
        }

        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    send({ to }, emitServerEvent) {
        if (USE_MOCK_TWILIO) {
            const securityCode = password.randomPassword({ length: 6, characters: password.digits });

            this.securityCodes[to] = securityCode;
            emitServerEvent(securityCode);

            return;
        }

        return this.verifyService.verifications.create({ to, channel: VERIFY_DELIVERY_CHANNEL });
    }

    async verify({ to, code }) {
        if (USE_MOCK_TWILIO) {
            return code === this.securityCodes[to];
        }

        const { valid } = await this.verifyService.verificationChecks.create({ to, code });
        return valid;
    }
};
