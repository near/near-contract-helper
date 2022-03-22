const twilio = require('twilio');
const password = require('secure-random-password');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const USE_MOCK_TWILIO = process.env.USE_MOCK_TWILIO === 'true';

module.exports = class TwilioVerifyService {
    static channels = {
        SMS: 'sms',
    }

    securityCodes = {};

    constructor({
        channel,
    }) {
        if (USE_MOCK_TWILIO) {
            return;
        }

        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.channel = channel;
        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    generateMockSecurityCode() {
        return password.randomPassword({ length: 6, characters: password.digits });
    }

    send({ to }, emitServerEvent) {
        if (USE_MOCK_TWILIO) {
            const securityCode = this.generateMockSecurityCode();

            this.securityCodes[to] = securityCode;
            emitServerEvent(securityCode);

            return;
        }

        return this.verifyService.verifications.create({ to, channel: this.channel });
    }

    verify({ to, code }) {
        if (USE_MOCK_TWILIO) {
            return { valid: code === this.securityCodes[to] };
        }

        return this.verifyService.verificationChecks.create({ to, code });
    }
};
