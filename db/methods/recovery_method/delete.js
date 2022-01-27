const { deleteDocument } = require('../../dynamo');
const RecoveryMethod = require('../../schemas/recovery_method');
const { buildRecoveryMethodRangeKey } = require('../../utils');

function deleteRecoveryMethod({ accountId, detail, kind, publicKey }) {
    return deleteDocument(RecoveryMethod, {
        accountId,
        compositeKey: buildRecoveryMethodRangeKey({ detail, kind, publicKey }),
    });
}

module.exports = deleteRecoveryMethod;
