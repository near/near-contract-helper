const { getNewAccountEmail, getSecurityCodeEmail } = require('./utils/email');

module.exports = {
    getNewAccountMessageContent({ accountId, recoverUrl, securityCode }) {
        const text = `
Welcome to NEAR Wallet!
This message contains your account activation code and recovery link for ${accountId}. Keep this message safe, and DO NOT SHARE IT. We cannot resend this message.

1. Confirm your activation code to finish creating your account:
${securityCode}

2. In the event that you need to recover your account, click the link below, and follow the directions in NEAR Wallet.
${recoverUrl}

Keep this message safe and DO NOT SHARE IT. We cannot resend this message.`;

        return {
            html: getNewAccountEmail(accountId, recoverUrl, securityCode),
            subject: `Important: Near Wallet Recovery Email for ${accountId}`,
            text
        };
    },

    getSecurityCodeMessageContent({ accountId, securityCode }) {
        const text = `Your NEAR Wallet security code is:
${securityCode}
Enter this code to verify your device.`;

        return {
            html: getSecurityCodeEmail(accountId, securityCode),
            subject: `Your NEAR Wallet security code is: ${securityCode}`,
            text
        };
    }
};