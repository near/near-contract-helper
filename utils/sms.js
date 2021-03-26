const FROM_PHONE = process.env.TWILIO_FROM_PHONE;

let lastSmsContent = {};

const sendSms = async ({ to, text }) => {
    if (process.env.NODE_ENV == 'production') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = require('twilio')(accountSid, authToken);
        await client.messages
            .create({
                body: text,
                from: FROM_PHONE,
                to
            });
    } else {
        console.log('sendSms:', { to, text });
        lastSmsContent = {to, text};
    }
};
module.exports = {
    sendSms,
    getLastSmsContent: () => lastSmsContent,
    clearLastSmsContent: () => { lastSmsContent = undefined; }
};