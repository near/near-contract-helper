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

async function findStakingDeposits(ctx) {
    const { accountId } = ctx.params;
    const client = await getPgClient();
    const { rows } = await client.query(`
        with deposit_in as (
            select SUM(to_number(args ->> 'deposit', '99999999999999999999999999999999999999')) deposit, receiver_account_id validator_id
            from receipts
                join action_receipt_actions using (receipt_id)
            where
                action_kind = 'FUNCTION_CALL' and
                args ->> 'method_name' like 'deposit%' and
                predecessor_account_id = $1 and
                receiver_account_id like '%pool%'
            group by receiver_account_id
        ), deposit_out as (
            select SUM(to_number(args ->> 'deposit', '99999999999999999999999999999999999999')) deposit, predecessor_account_id validator_id
            from receipts
            join action_receipt_actions using (receipt_id)
            where
                action_kind = 'TRANSFER' and
                receiver_account_id = $1 and
                predecessor_account_id like '%pool%'
            group by predecessor_account_id
        )
        select sum(deposit_in.deposit - coalesce(deposit_out.deposit, 0)) deposit, deposit_in.validator_id
        from deposit_in
        left join deposit_out on deposit_in.validator_id = deposit_out.validator_id
        group by deposit_in.validator_id;
    `, [accountId]);
    
    ctx.body = rows;
}

async function findAccountActivity(ctx) {
    const { accountId } = ctx.params;
    let { offset, limit = 10 } = ctx.request.query;
    if (!offset) {
        offset = '9999999999999999999'
    }
    const client = await getPgClient();
    const { rows } = await client.query(`
        select 
            receipt_id, included_in_block_timestamp, predecessor_account_id, receiver_account_id, action_kind, args, originated_from_transaction_hash, index_in_action_receipt
        from receipts
        join action_receipt_actions using(receipt_id)
        where 
            predecessor_account_id != 'system' and
            (predecessor_account_id = $1 or receiver_account_id = $1) and
            $2 > included_in_block_timestamp 
        order by included_in_block_timestamp desc     
        limit $3
        ;
    `, [accountId, offset, limit]);
    
    ctx.body = rows;
}

// TODO remove this extra client when explorer indexer is fixed to return implicit accountIds and caught up
let clientWallet;
async function getPgClientWallet() {
    if (!clientWallet) {
        clientWallet = new Client({
            connectionString: process.env.WALLET_INDEXER_DB_CONNECTION,
        });
        await clientWallet.connect();
    }
    return clientWallet;
}
async function findAccountsByPublicKey(ctx) {
    const { publicKey } = ctx.params;
    const client = await getPgClientWallet();
    const { rows } = await client.query('SELECT DISTINCT account_id FROM access_keys WHERE public_key = $1', [publicKey]);
    ctx.body = rows.map(({ account_id }) => account_id);
}

module.exports = {
    findStakingDeposits,
    findAccountActivity,
    findAccountsByPublicKey
};
