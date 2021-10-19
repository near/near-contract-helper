const bunyan = require('bunyan');
const SumoLogger = require('bunyan-sumologic');

const constants = require('../constants');

const {
    RECOVERY_METHOD_KINDS,
    TWO_FACTOR_AUTH_KINDS,
} = constants;

const {
    NODE_ENV,
    SUMO_COLLECTOR_ID,
    SUMO_ENDPOINT,
} = process.env;

const logger = bunyan.createLogger({
    name: `${NODE_ENV}/near-contract-helper`,
    streams: [{
        type: 'raw',
        stream: new SumoLogger({
            collector: SUMO_COLLECTOR_ID,
            endpoint:  SUMO_ENDPOINT,
        }),
    }],
});

function extractSmsMetadata(ctx) {
    let {
        identityKey: phoneNumber,
        kind,
        method,
    } = ctx.request.body;

    if (method && method.kind && method.detail) {
        ({ kind, detail: phoneNumber } = method);
    }

    if (kind === RECOVERY_METHOD_KINDS.PHONE || kind === TWO_FACTOR_AUTH_KINDS.PHONE) {
        return {
            kind,
            phoneNumber,
        };
    }

    return null;
}

function logSmsSend(ctx, next) {
    try {
        const smsMetadata = extractSmsMetadata(ctx);
        if (!smsMetadata) {
            return next();
        }

        const { kind, phoneNumber } = smsMetadata;
        const {
            ip,
            method,
            path,
        } = ctx.request;

        logger.info({
            ip,
            kind,
            method,
            path,
            phoneNumber,
        }, 'sms send');
    } catch (e) {
        console.warn('Failed to log request', e);
    }

    return next();
}

module.exports = {
    logSmsSend,
};
