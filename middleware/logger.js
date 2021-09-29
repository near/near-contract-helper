const bunyan = require('bunyan');
const SumoLogger = require('bunyan-sumologic');

const constants = require('../constants');

const {
    RECOVERY_METHOD_KINDS,
    TWO_FACTOR_AUTH_KINDS,
} = constants;

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

function logIdentityRequest(ctx, next) {
    try {
        const smsMetadata = extractSmsMetadata(ctx);
        const { kind, phoneNumber } = smsMetadata;
        const {
            ip,
            method,
            path,
        } = ctx.request;

        const logger = bunyan.createLogger({
            name: 'near-contract-helper',
            streams: [{
                type: 'raw',
                stream: new SumoLogger({
                    collector: process.env.SUMO_COLLECTOR_ID,
                    endpoint: process.env.SUMO_ENDPOINT,
                }),
            }],
        });

        logger.info({
            ip,
            kind,
            method,
            path,
            phoneNumber,
        });
    } catch (e) {
        console.warn('Failed to log request', e);
    }

    return next();
}

module.exports = {
    logIdentityRequest,
};
