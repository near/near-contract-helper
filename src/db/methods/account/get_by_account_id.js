const { getDocument } = require('../../dynamo');
const Account = require('../../schemas/account');

function getAccountById(accountId) {
    return getDocument(Account, { accountId });
}

module.exports = getAccountById;
