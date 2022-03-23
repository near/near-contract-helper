const { createDocument } = require('../../dynamo');
const Account = require('../../schemas/account');

function createAccount({ accountId, fundedAccountNeedsDeposit }) {
    return createDocument(Account, {
        accountId,
        fundedAccountNeedsDeposit,
    });
}

module.exports = createAccount;
