const { Client } = require('pg');

let client;
async function getPgClient() {
    if (!client) {
        client = new Client({
            connectionString: process.env.INDEXER_DB_CONNECTION,
        });
        await client.connect();
    }

    return client;
}

async function findAccountsByPublicKeyIndexer(ctx) {
    const { publicKey } = ctx.params;

    const client = await getPgClient();
    const { rows } = await client.query('SELECT account_id FROM access_keys WHERE public_key = $1', [publicKey]);
    ctx.body = rows.map(({ account_id }) => account_id);
}

// TODO: Remove the kludge when indexer is working well
const models = require('../models');
async function findAccountsByPublicKeyTemp(ctx) {
    const { publicKey } = ctx.params;

    const rows = await models.AccountByPublicKey.findAll({ where: { publicKey } });
    ctx.body = rows.map(({ accountId }) => accountId);
}

module.exports = { findAccountsByPublicKey: findAccountsByPublicKeyTemp, findAccountsByPublicKeyIndexer };