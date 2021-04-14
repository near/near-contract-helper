const twilio = require('twilio');

const FROM_PHONE = process.env.TWILIO_FROM_PHONE;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const sendSms = async ({ to, text }, emitSmsSentEvent) => {
    if (process.env.NODE_ENV == 'production') {
        const client = twilio(accountSid, authToken);

        await client.messages
            .create({
                body: text,
                from: FROM_PHONE,
                to
            });
    } else {
        emitSmsSentEvent({to, text});
    }
};
module.exports = {
    sendSms,
};