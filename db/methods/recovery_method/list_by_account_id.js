const { listDocuments } = require('../../dynamo');
const RecoveryMethod = require('../../schemas/recovery_method');

function listRecoveryMethodsByAccountId(accountId) {
    return listDocuments(RecoveryMethod, { hashKey: accountId });
}

module.exports = listRecoveryMethodsByAccountId;
