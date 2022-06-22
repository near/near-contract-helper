const MultiKeyAccountCreator = require('./MultiKeyAccountCreator');
const { creatorKeyJson, creatorKeysJson } = require('./near');

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

let accountCreator;

if (creatorKeysJson && creatorKeysJson.private_keys.length > 0) {
    accountCreator = new MultiKeyAccountCreator({
        sourceAccount: {
            accountId: creatorKeysJson.account_id,
            signingPrivKeys: creatorKeysJson.private_keys
        }
    });
}

const createAccount = async (ctx) => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(500, 'Service misconfigured; account creation is not available.');
    }

    const { newAccountId, newAccountPublicKey } = ctx.request.body;

    if (accountCreator) {
        if (!accountCreator.initialized) {
            await accountCreator.initialize();
        }

        ctx.body = await accountCreator.createAccount({
            accountId: newAccountId,
            publicKey: newAccountPublicKey,
            amount: NEW_ACCOUNT_AMOUNT
        });
    } else {
        const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
        ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
    }

};


module.exports = {
    createAccount,
};

