
const { sendSms } = require('./../providers/sms');
const { sendMail } = require('./../providers/email');

const WALLET_URL = process.env.WALLET_URL;
const sendRecoveryMessage = async ({ accountId, method, seedPhrase }) => {
    const recoverUrl = `${WALLET_URL}/recover-with-link/${encodeURIComponent(accountId)}/${encodeURIComponent(seedPhrase)}`;
    if (method.kind === 'phone') {
        await sendSms({
            text: `Your NEAR Wallet (${accountId}) recovery link is: ${recoverUrl}\nSave this message in a secure place to allow you to recover account.`,
            to: method.detail
        });
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail,
            subject: `Important: Near Wallet Recovery Email for ${accountId}`,
            text:
`Hi ${accountId},

This email contains your NEAR Wallet account recovery link.

Keep this email safe, and DO NOT SHARE IT! We cannot resend this email.

Click below to recover your account.

${recoverUrl}
`,
            html:
`<p>Hi ${accountId},</p>

<p>This email contains your NEAR Wallet account recovery link.</p>

<p>Keep this email safe, and DO NOT SHARE IT! We cannot resend this email.</p>

<p>Click below to recover your account.</p>

<a href="${recoverUrl}">Recover Account</a>
`

        });
    } else {
        throw new Error(`Account ${accountId} has no contact information`);
    }
};

const sendSecurityCode = async (securityCode, method) => {

    if (method.kind === 'phone') {
        await sendSms({
            text: `Your NEAR Wallet security code is: ${securityCode}`,
            to: method.detail
        });
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail,
            subject: `Your NEAR Wallet security code is: ${securityCode}`,
            text: `Use this code to confirm your email address: ${securityCode}`
        });
    }
};

async function recoveryMethodsFor(account) {
    if (!account) return [];

    return await account.getRecoveryMethods({
        attributes: ['createdAt', 'detail', 'kind', 'publicKey', 'securityCode']
    }).map(method => {
        const json = method.toJSON();
        json.confirmed = !method.securityCode;
        delete json.securityCode;
        return json;
    });
}
const recoveryMethods = ['email', 'phone', 'phrase'];

async function checkRecoveryMethod(ctx, next) {
    const { kind } = ctx.request.body;
    if (recoveryMethods.includes(kind)) {
        await next();
        return;
    }
    ctx.throw(400, `Given recoveryMethod '${kind}' invalid; must be one of: ${recoveryMethods.join(', ')}`);
}
module.exports = {
    sendRecoveryMessage,
    sendSecurityCode,
    recoveryMethodsFor,
    checkRecoveryMethod
};