const nearApi = require('near-api-js');
const models = require('../models');
const { Op } = require('sequelize');

const BATCH_SIZE = 1000;

(async function() {
    const near = await nearApi.connect({
        keyStore: new nearApi.keyStores.InMemoryKeyStore(),
        nodeUrl: process.env.NODE_URL
    });

    let lastBatchSize = BATCH_SIZE;
    let lastId;
    while (lastBatchSize >= BATCH_SIZE) {
        // TODO: accountId only
        const accounts = await models.Account.findAll({ 
            order: [['id', 'DESC']],
            limit: BATCH_SIZE,
            where: lastId ? { id: { [Op.lt]: lastId }} : {}
        });

        lastBatchSize = accounts.length;

        for (const account of accounts) {
            const { accountId, id } = account;
            console.log('Processing account', accountId);
            try {
                const nearAccount = await near.account(accountId);
                const keys = await nearAccount.getAccessKeys();
                const records = keys.map(({ public_key: publicKey }) => ({ publicKey, accountId }));
                await models.AccountByPublicKey.bulkCreate(records, { ignoreDuplicates: true });
                await models.AccountByPublicKey.destroy({ where: { accountId,  publicKey: { [Op.notIn]: keys.map(k => k.public_key) } }});
            } catch (e) {
                console.error('Error processing account', accountId, e);
            }
            lastId = id;
        }
    }

})().catch(e => console.error(e));