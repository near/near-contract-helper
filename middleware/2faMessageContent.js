const hex = require('hexer');
const nearAPI = require('near-api-js');
const escapeHtml = require('escape-html');

const fmtNear = (amount) => nearAPI.utils.format.formatNearAmount(amount, 4) + 'Ⓝ';

const formatArgs = (args) => {
    let output = '';

    const argsBuffer = Buffer.from(args, 'base64');
    try {
        const jsonString = argsBuffer.toString('utf-8');
        const parsed = JSON.parse(jsonString);

        // Composing new obj in specific order so `amount` and `deposit` will likely be in the first 250chars
        const { amount, deposit, ...json } = parsed;

        const formattedNear = {
            ...Object.hasOwnProperty.call(parsed, 'amount') && { amount: fmtNear(amount) },
            ...Object.hasOwnProperty.call(parsed, 'deposit') && { deposit: fmtNear(deposit) },
        };

        output = JSON.stringify({
            ...formattedNear,
            ...json
        });
    } catch (e) {
        // Cannot parse JSON, do hex dump
        output = hex(argsBuffer);
    }

    return output;
};

const formatAction = (receiver_id, { type, method_name, args, deposit, amount, public_key, permission }) => {
    switch (type) {
    case 'FunctionCall':
        return escapeHtml(`Calling method: ${ method_name } in contract: ${ receiver_id } with amount ${ deposit ? fmtNear(deposit) : '0' } and with args ${formatArgs(args)}`);
    case 'Transfer':
        return escapeHtml(`Transferring ${ fmtNear(amount) } to: ${ receiver_id }`);
    case 'Stake':
        return escapeHtml(`Staking: ${ fmtNear(amount) } to validator: ${ receiver_id }`);
    case 'AddKey':
        if (permission) {
            const { allowance, receiver_id, method_names } = permission;
            const methodsMessage = method_names && method_names.length > 0 ? `${method_names.join(', ')} methods` : 'any method';
            return escapeHtml(`Adding key ${ public_key } limited to call ${methodsMessage} on ${receiver_id} and spend up to ${fmtNear(allowance)} on gas`);
        }
        return escapeHtml(`Adding key ${ public_key } with FULL ACCESS to account`);
    case 'DeleteKey':
        return escapeHtml(`Deleting key ${ public_key }`);
    }
};

function getSecurityCodeText(securityCode, requestDetails) {
    return `
NEAR Wallet security code: ${securityCode}

Important: By entering this code, you are authorizing the following transaction${requestDetails.length > 1 ? 's' : ''}:
${requestDetails.join('\n')}
`;
}

function getVerify2faMethodMessageContent({ accountId, destination, securityCode }) {
    const requestDetails = [`Verify ${destination} as the 2FA method for account ${accountId}`];

    return {
        subject: `Confirm 2FA for ${accountId}`,
        text: getSecurityCodeText(securityCode, requestDetails),
        requestDetails,
    };
}

function getAddingFullAccessKeyMessageContent({ accountId, publicKey, request, securityCode }) {
    const { receiver_id, actions } = request;

    const requestDetails = actions.map(action => formatAction( receiver_id, action));

    const subject = 'Confirm Transaction WARNING - Adding FULL ACCESS KEY to Account: ' + accountId;
    const text = `
WARNING: Entering the code below will authorize full access to your NEAR account: "${accountId}". If you did not initiate this action, please DO NOT continue.

This should only be done if you are adding a new seed phrase to your account. In all other cases, this is very dangerous.

The public key you are adding is: ${publicKey}

If you'd like to proceed, enter this security code: ${securityCode}
`;
    return {
        subject,
        text,
        requestDetails
    };
}

function getConfirmTransactionMessageContent({ accountId, request, securityCode }) {
    const { receiver_id, actions } = request;

    const requestDetails = actions.map(action => formatAction(receiver_id, action));

    return {
        subject: `Confirm Transaction from: ${accountId} to: ${receiver_id}`,
        text: getSecurityCodeText(securityCode, requestDetails),
        requestDetails,
    };
}


module.exports = {
    getVerify2faMethodMessageContent,
    getConfirmTransactionMessageContent,
    getAddingFullAccessKeyMessageContent
};