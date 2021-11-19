const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

(async function() {
    const messages = await client.messages
        .list({
            dateSentBefore: new Date(Date.now() - 1800 * 1000),
            limit: 1000
        });
    console.log('Total messages: ', messages.length);
    for (const { sid } of messages) {
        console.log('Removing message: ', sid);
        try {
            await client.messages(sid).remove();
        } catch (e) {
            console.error('Error removing message: ', sid, e);
        }
    }
})().catch(e => console.error(e));

