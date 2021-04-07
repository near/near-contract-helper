const constants = require('../constants');

const { SERVER_EVENTS } = constants;

function attachMessageEchoListeners({ app, ECHO_MESSAGE_CONTENT }) {
    if (ECHO_MESSAGE_CONTENT) {
        app.on(SERVER_EVENTS.SENT_SMS, (smsContent) => {
            console.log('sms.to', smsContent.to);
            console.log('sms.text', smsContent.text);
        });

        app.on(SERVER_EVENTS.SENT_EMAIL, (emailContent) => {
            console.log('email.to', emailContent.to);
            console.log('email.subject', emailContent.subject);
            console.log('email.text', emailContent.text);
            // console.log('email.html', emailContent.html);
        });
    }
}

module.exports = attachMessageEchoListeners;