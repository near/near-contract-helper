const { updateDocument } = require('../../dynamo');
const Account = require('../../schemas/account');

function updateAccount(accountId, { fundedAccountNeedsDeposit }) {
    return updateDocument(Account, {
        accountId,
        fundedAccountNeedsDeposit,
    });
}

module.exports = updateAccount;
