const twilioClient = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const VERIFY_DELIVERY_CHANNEL = 'sms';

// https://www.twilio.com/docs/api/errors/XXXXX
const ERROR_RESPONSES_BY_CODE = {
    20404: { status: 429, text: '2FA request expired, please try again' },
    20429: { status: 429, text: '2FA rate limit for phone number reached, please try again later' },
    60202: { status: 429, text: '2FA verification check limit reached, please try again later' },
    60203: { status: 429, text: '2FA delivery limit reached, please try again later' },
};

const DEFAULT_ERROR_RESPONSE = {
    status: 500,
    text: 'Twilio Verify Error',
};

module.exports = class TwilioVerifyService {
    constructor({
        twilio = twilioClient,
    } = {}) {
        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    handleTwilioErrors(fn) {
        return fn().catch((error) => {
            error.response = ERROR_RESPONSES_BY_CODE[error.code] || DEFAULT_ERROR_RESPONSE;
            throw error;
        });
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
};
