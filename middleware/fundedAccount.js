const nearAPI = require('near-api-js');
const BN = require('bn.js');

const models = require('../models');
const recaptchaValidator = require('../RecaptchaValidator');
const { fundedCreatorKeyJson } = require('./near');

// TODO: Adjust gas to correct amounts
const MAX_GAS_FOR_ACCOUNT_CREATE = process.env.MAX_GAS_FOR_ACCOUNT_CREATE || '100000000000000';
const NEW_FUNDED_ACCOUNT_BALANCE = process.env.FUNDED_ACCOUNT_BALANCE || nearAPI.utils.format.parseNearAmount('0.35');
const FUNDED_NEW_ACCOUNT_CONTRACT_NAME = process.env.FUNDED_NEW_ACCOUNT_CONTRACT_NAME || 'near';

const BN_FUNDED_ACCOUNT_BALANCE_REQUIRED = (new BN(NEW_FUNDED_ACCOUNT_BALANCE).add(new BN(MAX_GAS_FOR_ACCOUNT_CREATE)));
const BN_UNLOCK_FUNDED_ACCOUNT_BALANCE = new BN(process.env.UNLOCK_FUNDED_ACCOUNT_BALANCE || nearAPI.utils.format.parseNearAmount('0.2'));

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.status = statusCode;
    ctx.body = body;
};

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


    const [[sequelizeAccount], fundingAccount] = await Promise.all([
        models.Account.findOrCreate({
            where: { accountId: newAccountId },
            defaults: { fundedAccountNeedsDeposit: true }
        }),
        ctx.near.account(fundedCreatorKeyJson.account_id)
    ]);

    try {
        const newAccountResult = await fundingAccount.functionCall(
            FUNDED_NEW_ACCOUNT_CONTRACT_NAME,
            'create_account',
            {
                new_account_id: newAccountId,
                new_public_key: newAccountPublicKey.replace(/^ed25519:/, '')
            },
            MAX_GAS_FOR_ACCOUNT_CREATE,
            NEW_FUNDED_ACCOUNT_BALANCE
        );

        ctx.body = {
            success: true,
            result: newAccountResult,
            requiredUnlockBalance: NEW_FUNDED_ACCOUNT_BALANCE
        };
    } catch (e) {
        await sequelizeAccount.destroy();

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

async function clearFundedAccountNeedsDeposit(ctx) {
    const { accountId, fundedAccountNeedsDeposit } = ctx.sequelizeAccount;

    if (!fundedAccountNeedsDeposit) {
        // This is an idempotent call
        ctx.status = 200;
        ctx.body = { success: true };
        return;
    }

    const nearAccount = await ctx.near.account(accountId);

    const { available } = await nearAccount.getAccountBalance();
    const availableBalanceBN = new BN(available);

    if (availableBalanceBN.gt(BN_UNLOCK_FUNDED_ACCOUNT_BALANCE)) {
        await ctx.sequelizeAccount.update({ fundedAccountNeedsDeposit: false });

        ctx.status = 200;
        ctx.body = { success: true };
        return;
    }

    setJSONErrorResponse({
        ctx,
        statusCode: 403,
        body: {
            success: false,
            code: 'NotEnoughBalance',
            message: `${accountId} does not have enough balance to be unlocked`,
            currentBalance: available,
            requiredUnlockBalance: BN_UNLOCK_FUNDED_ACCOUNT_BALANCE.toString()
        }
    });
}

const checkFundedAccountAvailable = async (ctx) => {
    try {
        const fundingAccount = await ctx.near.account(fundedCreatorKeyJson.account_id);

        const { available } = await fundingAccount.getAccountBalance();
        const availableBalanceBN = new BN(available);

        ctx.body = {
            available: availableBalanceBN.gt(BN_FUNDED_ACCOUNT_BALANCE_REQUIRED)
        };

        return;
    } catch (e) {
        // TODO: Sentry alert or other reporting?
        console.error('failed to calculate fund status', e);

        ctx.body = { available: false };
        return;
    }
};

module.exports = {
    checkFundedAccountAvailable,
    clearFundedAccountNeedsDeposit,
    createFundedAccount,
    BN_UNLOCK_FUNDED_ACCOUNT_BALANCE
};