const { deleteDocument } = require('../../dynamo');
const Account = require('../../schemas/account');

function deleteAccount(accountId) {
    return deleteDocument(Account, { accountId });
}

module.exports = deleteAccount;
