const { getDocument } = require('../../dynamo');
const RecoveryMethod = require('../../schemas/recovery_method');
const { buildRecoveryMethodRangeKey } = require('../../utils');

function getRecoveryMethodByIdentity({ accountId, kind, publicKey }) {
    return getDocument(RecoveryMethod, {
        accountId,
        compositeKey: buildRecoveryMethodRangeKey({ kind, publicKey }),
    });
}

module.exports = getRecoveryMethodByIdentity;
