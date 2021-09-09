'use strict';

const password = require('secure-random-password');

const { getSecurityCodeMessageContent } = require('../accountRecoveryMessageContent');
const constants = require('../constants');

const { IdentityVerificationMethod } = require('../models');
const { sendMail } = require('../utils/email');
const { sendSms } = require('../utils/sms');

const { IDENTITY_VERIFICATION_METHOD_KINDS, SERVER_EVENTS } = constants;

const SECURITY_CODE_DIGITS = 6;

const setJSONErrorResponse = ({ ctx, statusCode, body }) => {
    ctx.status = statusCode;
    ctx.body = body;
};

async function createIdentityVerificationMethod(ctx) {
    const {
        type: kind,
        identityKey
    } = ctx.request.body;

    if (!kind) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'typeRequired' }
        });
        return;
    }

    if (!Object.values(IDENTITY_VERIFICATION_METHOD_KINDS).includes(kind)) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'invalidVerificationType' }
        });
        return;
    }

    if (!identityKey) {
        setJSONErrorResponse({
            ctx,
            statusCode: 400,
            body: { success: false, code: 'identityKeyRequired' }
        });
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

    // Set a new security code every time someone POSTs for a particular type and identityKey combination
    // unless the existing has already been claimed.
    if (verificationMethod.claimed === true) {
        setJSONErrorResponse({
            ctx,
            statusCode: 409,
            body: { success: false, code: 'identityVerificationAlreadyClaimed' }
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

module.exports = { createIdentityVerificationMethod };