'use strict';

const password = require('secure-random-password');

const { getSecurityCodeMessageContent } = require('../accountRecoveryMessageContent');
const constants = require('../constants');

const { IdentityVerificationMethod } = require('../models');
const { sendMail } = require('../utils/email');
const { sendSms } = require('../utils/sms');

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
};


const getEmailBlacklist = () => {
    let blacklist = [];

    if (process.env.IDENTITY_VERIFICATION_EMAIL_BLACKLIST) {
        blacklist = process.env.IDENTITY_VERIFICATION_EMAIL_BLACKLIST.split(',');
    }

    // http://24mail.chacuo.net/enus
    blacklist.push('chacuo.net');
    blacklist.push('027168.com');

    return blacklist;
};

const IDENTITY_VERIFICATION_EMAIL_BLACKLIST = getEmailBlacklist();

const isEmailBlacklisted = (email) => IDENTITY_VERIFICATION_EMAIL_BLACKLIST
    .some((blacklistVal) => email.includes(blacklistVal));

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.status = statusCode;
    ctx.body = body;
};

function validateVerificationParams({ ctx, kind, identityKey }) {
    if (!kind) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.KIND_REQUIRED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.KIND_REQUIRED.code }
        });
        return false;
    }

    if (!Object.values(IDENTITY_VERIFICATION_METHOD_KINDS).includes(kind)) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.code }
        });
        return false;
    }

    if (kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL) {
        if (isEmailBlacklisted(identityKey)) {
            setJSONErrorResponse({
                ctx,
                statusCode: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.statusCode,
                body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.INVALID_KIND.code }
            });
            return false;
        }
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

async function createIdentityVerificationMethod(ctx) {
    const {
        kind,
        identityKey
    } = ctx.request.body;

    if (!validateVerificationParams({ ctx, kind, identityKey })) {
        return;
    }

    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });

    const [verificationMethod, verificationMethodCreatedByThisCall] = await IdentityVerificationMethod.findOrCreate({
        where: {
            identityKey,
            kind,
        },
        defaults: {
            securityCode
        }
    });

    // Set a new security code every time someone POSTs for a particular kind and identityKey combination
    // unless the existing has already been claimed.
    if (verificationMethod.claimed === true) {
        setJSONErrorResponse({
            ctx,
            statusCode: IDENTITY_VERIFICATION_ERRORS.ALREADY_CLAIMED.statusCode,
            body: { success: false, code: IDENTITY_VERIFICATION_ERRORS.ALREADY_CLAIMED.code }
        });
        return;
    }

    if (!verificationMethodCreatedByThisCall) {
        await verificationMethod.update({ securityCode });
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
    IDENTITY_VERIFICATION_ERRORS
};