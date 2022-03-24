const twilio = require('twilio');
const password = require('secure-random-password');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const USE_MOCK_TWILIO = process.env.USE_MOCK_TWILIO === 'true';

const VERIFY_DELIVERY_CHANNEL = 'sms';

// https://www.twilio.com/docs/api/errors/XXXXX
const ERROR_RESPONSES_BY_CODE = {
    20404: { status: 429, text: '2FA request expired, please try again' },
    20429: { status: 429, text: '2FA rate limit reached, please try again later' },
    60202: { status: 429, text: '2FA verification check limit reached, please try again later' },
    60203: { status: 429, text: '2FA delivery limit reached, please try again later' },
};

const DEFAULT_ERROR_RESPONSE = {
    status: 500,
    text: 'Twilio Verify Error',
};

class TwilioVerifyService {
    constructor() {
        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    async handleTwilioErrors(fn) {
        try {
            return await fn();
        } catch (error) {
            error.response = ERROR_RESPONSES_BY_CODE[error.code] || DEFAULT_ERROR_RESPONSE;
            throw error;
        }
    }

    send({ to }) {
        return this.handleTwilioErrors(() => {
            return this.verifyService.verifications.create({ to, channel: VERIFY_DELIVERY_CHANNEL });
        });
    }

    verify({ to, code }) {
        return this.handleTwilioErrors(async () => {
            const { valid } = await this.verifyService.verificationChecks.create({ to, code });
            return valid;
        });
    }
}

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


module.exports = USE_MOCK_TWILIO ? MockTwilioVerifyService : TwilioVerifyService;
