const hex = require('hexer');
const nearAPI = require('near-api-js');
const escapeHtml = require('escape-html');

const getVerifyAs2faMethodText = ({
    recipient,
    accountId
}) => `Verify ${recipient} as the 2FA method for account ${accountId}`;

const fmtNear = (amount) => nearAPI.utils.format.formatNearAmount(amount, 4) + 'Ⓝ';

const TRUNCATE_ARGUMENTS_LENGTH = 247;

const formatArgs = (args, isForSms) => {
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

    if (isForSms && output.length >= TRUNCATE_ARGUMENTS_LENGTH) {
        // Twilio SMS limits total message size to 1600chars...
        output = output.slice(0, TRUNCATE_ARGUMENTS_LENGTH) + '...';
    }

    return output;
};

const formatAction = (
    { receiver_id, isForSms },
    {
        type,
        method_name,
        args,
        deposit,
        amount,
        public_key,
        permission
    }
) => {
    function escapeHtmlIfNotSMS(str) {
        if (isForSms) { return str; }
        return escapeHtml(str);
    }

    switch (type) {
    case 'FunctionCall':
        return escapeHtmlIfNotSMS(`Calling method: ${method_name} in contract: ${receiver_id} with amount ${deposit ? fmtNear(deposit) : '0'} and with args ${formatArgs(args, isForSms)}`);
    case 'Transfer':
        return escapeHtmlIfNotSMS(`Transferring ${fmtNear(amount)} to: ${receiver_id}`);
    case 'Stake':
        return escapeHtmlIfNotSMS(`Staking: ${fmtNear(amount)} to validator: ${receiver_id}`);
    case 'AddKey':
        if (permission) {
            const { allowance, receiver_id, method_names } = permission;
            const methodsMessage = method_names && method_names.length > 0 ? `${method_names.join(', ')} methods` : 'any method';
            return escapeHtmlIfNotSMS(`Adding key ${public_key} limited to call ${methodsMessage} on ${receiver_id} and spend up to ${fmtNear(allowance)} on gas`);
        }
        return escapeHtmlIfNotSMS(`Adding key ${public_key} with FULL ACCESS to account: "${receiver_id}"`);
    case 'DeleteKey':
        return escapeHtmlIfNotSMS(`Deleting key ${public_key}`);
    }
};


function getSecurityCodeText(securityCode, requestDetails) {
    return `
NEAR Wallet security code: ${securityCode}

Important: By entering this code, you are authorizing the following transaction${requestDetails.length > 1 ? 's' : ''}:

${requestDetails.join('\n')}
`;
}

function getVerify2faMethodMessageContent({ accountId, recipient, securityCode }) {
    const requestDetails = [getVerifyAs2faMethodText({ accountId, recipient })];

    return {
        subject: `Confirm 2FA for ${accountId}`,
        text: getSecurityCodeText(securityCode, requestDetails),
        requestDetails,
    };
}

function getAddingFullAccessKeyMessageContent({ accountId, publicKey, request, securityCode, isForSms }) {
    const { receiver_id, actions } = request;

    const requestDetails = actions.map(action => formatAction({ receiver_id, isForSms }, action));

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

function getConfirmTransactionMessageContent({ accountId, request, securityCode, isForSms }) {
    const { receiver_id, actions } = request;

    const requestDetails = actions.map(action => formatAction({ accountId, receiver_id, isForSms }, action));

    return {
        subject: `Confirm Transaction from: ${accountId} to: ${receiver_id}`,
        text: getSecurityCodeText(securityCode, requestDetails),
        requestDetails,
    };
}


module.exports = {
    getVerify2faMethodMessageContent,
    getConfirmTransactionMessageContent,
    getAddingFullAccessKeyMessageContent,
    formatArgs,
    formatAction
};