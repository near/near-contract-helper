const { parseNearAmount } = require('near-api-js');
const { NotEnoughBalanceError } = require('near-api-js/rpc-errors');

const recaptchaValidator = require('../RecaptchaValidator');
const AccountService = require('../services/account');
const IdentityVerificationMethodService = require('../services/identity_verification_method');
const { fundedCreatorKeyJson } = require('./near');
const {
    IDENTITY_VERIFICATION_ERRORS,
    validateVerificationParams,
    validateEmail,
    setAlreadyClaimedResponse,
    setInvalidRecaptchaResponse
} = require('./identityVerificationMethod');

const accountService = new AccountService();
const identityVerificationMethodService = new IdentityVerificationMethodService();

// TODO: Adjust gas to correct amounts
const MAX_GAS_FOR_ACCOUNT_CREATE = BigInt(process.env.MAX_GAS_FOR_ACCOUNT_CREATE || '100000000000000');
const NEW_FUNDED_ACCOUNT_BALANCE = process.env.FUNDED_ACCOUNT_BALANCE || parseNearAmount('0.35');
const FUNDED_NEW_ACCOUNT_CONTRACT_NAME = process.env.FUNDED_NEW_ACCOUNT_CONTRACT_NAME || 'near';

// Leave a buffer of 0.5N in coin-op to avoid corner cases where we got 'not enough storage' error instead of
// NotEnoughBalance error
const MIN_FUNDING_ACCOUNT_BALANCE = BigInt(parseNearAmount('0.5'));

// DEPRECATED: Remove after coin-op v1.5 is settled
const FUNDED_ACCOUNT_BALANCE_REQUIRED = BigInt(NEW_FUNDED_ACCOUNT_BALANCE) + MAX_GAS_FOR_ACCOUNT_CREATE;
const UNLOCK_FUNDED_ACCOUNT_BALANCE = BigInt(process.env.UNLOCK_FUNDED_ACCOUNT_BALANCE || parseNearAmount('0.2'));

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.status = statusCode;
    ctx.body = body;
};

async function doCreateFundedAccount({
    fundingAccount,
    newAccountId,
    newAccountPublicKey,
    ctx,
    isExistingAccount,
}) {
    const available = await fundingAccount.getBalance();

    if (available <= MIN_FUNDING_ACCOUNT_BALANCE) {
        setJSONErrorResponse({
            ctx,
            statusCode: 503,
            body: { success: false, code: 'NotEnoughBalance', message: 'Not enough balance to create funded account' }
        });
        return;
    }

    try {
        const newAccountResult = await fundingAccount.callFunctionRaw({
            contractId: FUNDED_NEW_ACCOUNT_CONTRACT_NAME,
            methodName: 'create_account',
            args: {
                new_account_id: newAccountId,
                new_public_key: newAccountPublicKey.replace(/^ed25519:/, '')
            },
            gas: MAX_GAS_FOR_ACCOUNT_CREATE,
            deposit: BigInt(NEW_FUNDED_ACCOUNT_BALANCE),
        });

        ctx.body = {
            success: true,
            result: newAccountResult,
            requiredUnlockBalance: NEW_FUNDED_ACCOUNT_BALANCE
        };
    } catch (e) {
        if (!isExistingAccount) {
            // Clean up if we were responsible for creating it during this API call
            await accountService.deleteAccount(newAccountId);
        }

        if (e instanceof NotEnoughBalanceError) {
            setJSONErrorResponse({
                ctx,
                statusCode: 503,
                body: { success: false, code: 'NotEnoughBalance', message: e.message }
            });
            return;
        }

        ctx.throw(e);
    }
}

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

    // If someone is using a recovery method that involves a confirmation code (email / SMS)
    // then we need to manually set the fundedAccountNeedsDeposit on the _existing_ record
    const isExistingAccount = !!(await accountService.getAccount(newAccountId));
    const fundingAccount = ctx.near.account(fundedCreatorKeyJson.account_id);
    await (isExistingAccount
        ? accountService.setAccountRequiresDeposit(newAccountId, true)
        : accountService.createAccount(newAccountId, { fundedAccountNeedsDeposit: true }));

    await doCreateFundedAccount({
        fundingAccount,
        newAccountId,
        newAccountPublicKey,
        ctx,
        isExistingAccount,
    });
};

async function createIdentityVerifiedFundedAccount(ctx) {
    if (!fundedCreatorKeyJson) {
        console.warn('FUNDED_ACCOUNT_CREATOR_KEY is not set, cannot create funded accounts.');
        ctx.throw(500, 'Funded account creation is not available.');
    }

    const {
        kind,
        newAccountId,
        newAccountPublicKey,
        identityKey,
        verificationCode,
        recaptchaToken,
        recaptchaSiteKey,
        recaptchaAction,
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

    if (!await validateVerificationParams({ ctx, kind, identityKey })) {
        return;
    }

    if (!verificationCode) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_REQUIRED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_REQUIRED.code }
        });
        return;
    }

    const { valid, score } = await recaptchaValidator.createEnterpriseAssessment({
        token: recaptchaToken,
        siteKey: recaptchaSiteKey,
        userIpAddress: ctx.ip,
        userAgent: ctx.header['user-agent'],
        expectedAction: recaptchaAction
    });


    if (!valid || score < 0.6) {
        console.log('Blocking createIdentityVerifiedFundedAccount due to low score', {
            userAgent: ctx.header['user-agent'],
            userIpAddress: ctx.ip,
            expectedAction: recaptchaAction,
            score,
            valid
        });

        setInvalidRecaptchaResponse(ctx);
        return;
    }

    if (!await validateEmail({ ctx, email: identityKey, kind })) {
        return;
    }

    const verificationMethod = await identityVerificationMethodService.getIdentityVerificationMethod({
        identityKey,
    });

    if (!verificationMethod) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_INVALID.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_INVALID.code }
        });
        return;
    }

    if (verificationMethod.claimed === true) {
        setAlreadyClaimedResponse(ctx);
        return;
    }

    // 15 minute expiration for codes; don't allow anything older to be used.
    if ((Date.now().valueOf() - (new Date(verificationMethod.updatedAt)).valueOf()) > (60 * 1000 * 15)) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_EXPIRED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_EXPIRED.code }
        });
        return;
    }

    if (verificationMethod.securityCode !== verificationCode) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_INVALID.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.VERIFICATION_CODE_INVALID.code }
        });
        return;
    }

    const account = await accountService.getAccount(newAccountId);
    const fundingAccount = ctx.near.account(fundedCreatorKeyJson.account_id);

    await doCreateFundedAccount({
        fundingAccount,
        newAccountId,
        newAccountPublicKey,
        ctx,
        isExistingAccount: !!account,
    });

    if (ctx.status === 200) {
        await identityVerificationMethodService.claimIdentityVerificationMethod({ identityKey, kind });
    }
}

async function clearFundedAccountNeedsDeposit(ctx) {
    // DEPRECATED: Remove after coin-op v1.5 is settled

    const { accountId } = ctx.request.body;
    const account = await accountService.getAccount(accountId);
    if (!account.fundedAccountNeedsDeposit) {
        // This is an idempotent call
        ctx.status = 200;
        ctx.body = { success: true };
        return;
    }

    const nearAccount = ctx.near.account(accountId);
    const available = await nearAccount.getBalance();

    if (available > UNLOCK_FUNDED_ACCOUNT_BALANCE) {
        await accountService.setAccountRequiresDeposit(accountId, false);
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
            currentBalance: available.toString(),
            requiredUnlockBalance: UNLOCK_FUNDED_ACCOUNT_BALANCE.toString()
        }
    });
}

const checkFundedAccountAvailable = async (ctx) => {
    if (!fundedCreatorKeyJson) {
        ctx.body = { available: false };
        return;
    }

    try {
        const fundingAccount = ctx.near.account(fundedCreatorKeyJson.account_id);
        const available = await fundingAccount.getBalance();

        ctx.body = {
            available: available > FUNDED_ACCOUNT_BALANCE_REQUIRED
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
    createIdentityVerifiedFundedAccount,
    UNLOCK_FUNDED_ACCOUNT_BALANCE
};
