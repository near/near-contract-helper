'use strict';

const password = require('secure-random-password');

const recaptchaValidator = require('../RecaptchaValidator');
const { getSecurityCodeMessageContent } = require('../accountRecoveryMessageContent');
const constants = require('../constants');
const IdentityVerificationMethodService = require('../services/identity_verification_method');
const { sendMail } = require('../utils/email');
const { sendSms } = require('../utils/sms');
const createEmailDomainValidator = require('../EmailDomainValidator');

const ENABLE_EMAIL_IDENTITY_VERIFICATION_METHOD = process.env.ENABLE_EMAIL_IDENTITY_VERIFICATION === 'true' || false;
const ENABLE_PHONE_IDENTITY_VERIFICATION_METHOD = process.env.ENABLE_PHONE_IDENTITY_VERIFICATION === 'true' || true;

const { IDENTITY_VERIFICATION_METHOD_KINDS, SERVER_EVENTS } = constants;

const SECURITY_CODE_DIGITS = 6;

const IDENTITY_VERIFICATION_ERRORS = {
    KIND_REQUIRED: { code: 'kindRequired', statusCode: 400 },
    VERIFICATION_CODE_REQUIRED: { code: 'identityVerificationCodeRequired', statusCode: 400 },
    IDENTITY_KEY_REQUIRED: { code: 'identityKeyRequired', statusCode: 400 },
    INVALID_KIND: { code: 'invalidVerificationKind', statusCode: 400 },
    ALREADY_CLAIMED: { code: 'identityVerificationAlreadyClaimed', statusCode: 409 },
    VERIFICATION_CODE_INVALID: { code: 'identityVerificationCodeInvalid', statusCode: 409 },
    VERIFICATION_CODE_EXPIRED: { code: 'identityVerificationCodeExpired', statusCode: 409 },
    RECAPTCHA_INVALID: { code: 'identityVerificationRecaptchaInvalid', statusCode: 400 },
    INVALID_EMAIL_PROVIDER: { code: 'identityVerificationEmailProviderInvalid', statusCode: 400 }
};

const emailDomainValidator = createEmailDomainValidator();
const identityVerificationMethodService = new IdentityVerificationMethodService();

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.status = statusCode;
    ctx.body = body;
};

async function validateEmail({ ctx, email, kind }) {
    if (kind !== IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL) {
        return true;
    }
    const domainName = email.split('@')[1];
    const isDomainValid = await emailDomainValidator.isDomainValid(domainName);
    if (!isDomainValid) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.INVALID_EMAIL_PROVIDER.statusCode,
            body: {
                success: false,
                code: IDENTITY_VERIFICATION_ERRORS.INVALID_EMAIL_PROVIDER.code,
                domainName
            }
        });
        return false;
    }

    return true;
}

async function validateVerificationParams({ ctx, kind, identityKey }) {
    if (!kind) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.KIND_REQUIRED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.KIND_REQUIRED.code }
        });
        return false;
    }

    if (
        (!ENABLE_EMAIL_IDENTITY_VERIFICATION_METHOD && kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL) ||
        (!ENABLE_PHONE_IDENTITY_VERIFICATION_METHOD && kind === IDENTITY_VERIFICATION_METHOD_KINDS.PHONE) ||
        !Object.values(IDENTITY_VERIFICATION_METHOD_KINDS).includes(kind)
    ) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.code }
        });
        return false;
    }

    if (!identityKey) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.IDENTITY_KEY_REQUIRED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.IDENTITY_KEY_REQUIRED.code }
        });
        return false;
    }

    return true;
}

function setAlreadyClaimedResponse(ctx) {
    setJSONErrorResponse({
        ctx,
        statusCode: IDENTITY_VERIFICATION_ERRORS.ALREADY_CLAIMED.statusCode,
        body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.ALREADY_CLAIMED.code }
    });
}

function setInvalidRecaptchaResponse(ctx) {
    setJSONErrorResponse({
        ctx,
        statusCode: IDENTITY_VERIFICATION_ERRORS.RECAPTCHA_INVALID.statusCode,
        body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.RECAPTCHA_INVALID.code }
    });
}

async function createIdentityVerificationMethod(ctx) {
    const {
        kind,
        identityKey,
        recaptchaToken,
        recaptchaAction,
        recaptchaSiteKey,
    } = ctx.request.body;

    if (!await validateVerificationParams({ ctx, kind, identityKey })) {
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
        console.log('Blocking createIdentityVerificationMethod due to low score', {
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

    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });

    const isIdentityRecoverable = await identityVerificationMethodService.recoverIdentity({
        identityKey,
        kind,
        securityCode,
    });

    if (!isIdentityRecoverable) {
        setAlreadyClaimedResponse(ctx);
        return;
    }

    const { html, subject, text } = getSecurityCodeMessageContent({ securityCode });

    if (kind === IDENTITY_VERIFICATION_METHOD_KINDS.PHONE) {
        await sendSms(
            { to: identityKey, text },
            (smsContent) => ctx.app.emit(SERVER_EVENTS.SENT_SMS, smsContent) // For test harness
        );
    } else if (kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL) {
        await sendMail(
            {
                to: identityKey,
                text,
                html,
                subject,
            },
            (emailContent) => ctx.app.emit(SERVER_EVENTS.SENT_EMAIL, emailContent) // For test harness
        );
    }

    ctx.body = { success: true };
}

module.exports = {
    createIdentityVerificationMethod,
    validateVerificationParams,
    emailDomainValidator,
    validateEmail,
    setAlreadyClaimedResponse,
    setInvalidRecaptchaResponse,
    IDENTITY_VERIFICATION_ERRORS
};
