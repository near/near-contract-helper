const nearAPI = require('near-api-js');

const creatorKeyJson = (() => {
    try {
        return JSON.parse(process.env.ACCOUNT_CREATOR_KEY);
    } catch (e) {
        console.warn(`Account creation not available.\nError parsing ACCOUNT_CREATOR_KEY='${process.env.ACCOUNT_CREATOR_KEY}':`, e);
        return null;
    }
})();

const keyStore = {
    async getKey() {
        return nearAPI.KeyPair.fromString(creatorKeyJson.secret_key || creatorKeyJson.private_key);
    },
};

const nearPromise = (async () => {
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    return near;
})();

const getContract = async (contractName, viewMethods, changeMethods, secretKey) => {
    const keyStore = {
        async getKey() {
            return nearAPI.KeyPair.fromString(secretKey);
        },
    };
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
	const contractAccount = new nearAPI.Account(near.connection, contractName)
    const contract = new nearAPI.Contract(contractAccount, contractName, {
        viewMethods,
        changeMethods,
    })
    return contract
} 

module.exports = {
    creatorKeyJson,
    keyStore,
    nearPromise,
    getContract,
}