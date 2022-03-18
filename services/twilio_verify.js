const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

class TwilioVerifyService {
    static channels = {
        SMS: 'sms',
    }

    constructor({
        channel,
    }) {
        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        this.channel = channel;
        this.verifyService = client
            .verify
            .services(VERIFY_SERVICE_SID);
    }

    send({ to }) {
        return this.verifyService.verifications.create({ to, channel: this.channel });
    }

    verify({ to, code }) {
        return this.verifyService.verificationChecks.create({ to, code });
    }
}

module.exports = TwilioVerifyService;
