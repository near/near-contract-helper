const { createDocument } = require('../../dynamo');
const RecoveryMethod = require('../../schemas/recovery_method');
const { buildRecoveryMethodRangeKey } = require('../../utils');

function createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
    return createDocument(RecoveryMethod, {
        accountId,
        compositeKey: buildRecoveryMethodRangeKey({ kind, publicKey }),
        detail,
        kind,
        publicKey,
        requestId,
        securityCode,
    });
}

module.exports = createRecoveryMethod;
