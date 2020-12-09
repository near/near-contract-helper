const { Client } = require('pg');

let client;
async function getPgClient() {
    if (!client) {
        client = new Client({
            connectionString: process.env.INDEXER_DB_CONNECTION_2,
        });
        await client.connect();
    }

    return client;
}

async function getStakingTxs(ctx) {
    const { accountId } = ctx.params;

    const client = await getPgClient();
    const { rows } = await client.query(`
        select 
        receiver_account_id validator_id,
        args->>'method_name' method_name,
        coalesce(nullif(args->>'deposit', '0'), convert_from(decode(args->>'args_base64', 'base64'), 'utf8')::jsonb->>'amount', '0') amount,
        included_in_block_timestamp ts
        from receipts
        inner join action_receipt_actions using(receipt_id)
        where
        predecessor_account_id = $1 and
        action_kind = 'FUNCTION_CALL' and 
        args->>'method_name' in ('stake', 'deposit_and_stake', 'unstake', 'unstake_all')
        limit 9999
    `, [accountId]);
    
    ctx.body = rows;
}

module.exports = {
    getStakingTxs
};
