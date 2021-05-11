const nearAPI = require('near-api-js');

const recaptchaValidator = require('../RecaptchaValidator');

const {
    creatorKeyJson,
    fundedCreatorKeyJson,
} = require('./near');

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.type = 'json';
    ctx.status = statusCode;
    ctx.body = body;
};

const createAccount = async (ctx) => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(500, 'Service misconfigured; account creation is not available.');
    }

    const { newAccountId, newAccountPublicKey } = ctx.request.body;

    if (newAccountId.includes('dzarezenko')) {
        ctx.throw(403);
    }

    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
};

// TODO: Adjust gas to correct amounts
const MAX_GAS_FOR_ACCOUNT_CREATE = process.env.MAX_GAS_FOR_ACCOUNT_CREATE || '100000000000000';
const FUNDED_ACCOUNT_BALANCE = process.env.FUNDED_ACCOUNT_BALANCE || nearAPI.utils.format.parseNearAmount('500');
const FUNDED_NEW_ACCOUNT_CONTRACT_NAME = process.env.FUNDED_NEW_ACCOUNT_CONTRACT_NAME || 'near';
const createFundedAccount = async (ctx) => {
    if (!fundedCreatorKeyJson) {
        console.warn('FUNDED_ACCOUNT_CREATOR_KEY is not set, cannot create funded accounts.');
        ctx.throw(500, 'Funded account creation is not available.');
    }

    const {
        newAccountId,
        newAccountPublicKey,
        recaptchaCode,
    } = ctx.request.body;

    if (!newAccountId) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'newAccountIdRequired' }
        });
        return;
    }

    if (!newAccountPublicKey) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'newAccountPublicKeyRequired' }
        });
        return;
    }

    if (!recaptchaCode) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'recaptchaCodeRequired' }
        });
        return;
    }

    const { success, error, code } = await recaptchaValidator.validateRecaptchaCode(recaptchaCode, ctx.ip);

    if (!success) {
        const { statusCode, message } = error;

        setJSONErrorResponse({
            ctx,
            statusCode,
            body: { success: false, code, message }
        });
        return;
    }

    const fundingAccount = await ctx.near.account(fundedCreatorKeyJson.account_id);

    // TODO: Should the client get something different than the result of this call?
    try {
        const newAccountResult = await fundingAccount.functionCall(
            FUNDED_NEW_ACCOUNT_CONTRACT_NAME,
            'create_account',
            {
                new_account_id: newAccountId,
                new_public_key: newAccountPublicKey.replace(/^ed25519:/, '')
            },
            MAX_GAS_FOR_ACCOUNT_CREATE,
            FUNDED_ACCOUNT_BALANCE
        );

        ctx.body = { success: true, result: newAccountResult };
    } catch (e) {
        if (e.type === 'NotEnoughBalance') {
            setJSONErrorResponse({
                ctx,
                statusCode: 503,
                body: { success: false, code: 'NotEnoughBalance', message: e.message }
            });
            return;
        }

        ctx.throw(e);
    }
};


module.exports = {
    createAccount,
    createFundedAccount,
};