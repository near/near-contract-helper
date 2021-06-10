const { creatorKeyJson } = require('./near');

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

const createAccount = async (ctx) => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(500, 'Service misconfigured; account creation is not available.');
    }

    const { newAccountId, newAccountPublicKey } = ctx.request.body;

    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
};


module.exports = {
    createAccount,
};

