const { Client } = require('pg');

let client;
async function getPgClient() {
    if (!client) {
        client = new Client({
            connectionString: process.env.EXPLORER_INDEXER_DB_CONNECTION,
        });
        await client.connect();
    }

    return client;
}

async function findReceivers(ctx) {
    const { accountId } = ctx.params;

    const client = await getPgClient();
    const { rows } = await client.query(`
        select distinct receiver_account_id from receipts
        join action_receipt_actions on action_receipt_actions.receipt_id = receipts.receipt_id
        where predecessor_account_id = $1
            and action_kind = 'FUNCTION_CALL'
    `, [accountId]);
    ctx.body = rows.map(({ receiver_account_id }) => receiver_account_id);
}

module.exports = {
    findReceivers
};
