const createRecoveryMethod = require('./create');
const deleteRecoveryMethod = require('./delete');
const getRecoveryMethodByIdentity = require('./get_by_identity');
const listRecoveryMethodsByAccountId = require('./list_by_account_id');
const updateRecoveryMethod = require('./update');

module.exports = {
    createRecoveryMethod,
    deleteRecoveryMethod,
    getRecoveryMethodByIdentity,
    listRecoveryMethodsByAccountId,
    updateRecoveryMethod,
};
