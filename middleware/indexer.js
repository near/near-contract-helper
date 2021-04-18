const { Pool } = require('pg');

const BRIDGE_TOKEN_FACTORY_ACCOUNT_ID = process.env.BRIDGE_TOKEN_FACTORY_ACCOUNT_ID || 'factory.bridge.near';

let pool;
const withPgClient = (fn) => async (ctx) => {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.INDEXER_DB_CONNECTION,
        });
    }

    const client = await pool.connect();
    ctx.client = client;
    try {
        return fn(ctx);
    } finally {
        client.release();
    }
};

const findStakingDeposits = withPgClient(async (ctx) => {
    const { accountId } = ctx.params;
    const { client } = ctx;
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
});

const findAccountActivity = withPgClient(async (ctx) => {
    const { accountId } = ctx.params;
    let { offset, limit = 10 } = ctx.request.query;
    if (!offset) {
        offset = '9999999999999999999';
    }
    const { client } = ctx;
    const { rows } = await client.query(`
        select
            included_in_block_hash block_hash,
            included_in_block_timestamp block_timestamp,
            originated_from_transaction_hash hash,
            index_in_action_receipt action_index,
            predecessor_account_id signer_id,
            receiver_account_id receiver_id,
            action_kind,
            args
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
});

const findAccountsByPublicKey = withPgClient(async (ctx) => {
    const { publicKey } = ctx.params;
    const { client } = ctx;
    const { rows } = await client.query(`
        SELECT DISTINCT account_id
        FROM access_keys
        JOIN accounts USING (account_id)
        WHERE public_key = $1
            AND accounts.deleted_by_receipt_id IS NULL
            AND access_keys.deleted_by_receipt_id IS NULL
    `, [publicKey]);
    ctx.body = rows.map(({ account_id }) => account_id);
});

const findReceivers = withPgClient(async (ctx) => {
    const { accountId } = ctx.params;
    const { client } = ctx;

    // TODO: Make sure indexer for explorer DB allows for faster way to do it in prod
    // NOTE: Looks like not doing a join is much faster (not surprising, but doesn't allow for FUNCTION_CALL filtering)
    // So potential solution might be to maintain materialized view of likely tokens and query for all receivers instead
    const { rows } = await client.query(`
        select distinct receiver_account_id from receipts
        join action_receipt_actions on using (receipt_id)
        where predecessor_account_id = $1
            and action_kind = 'FUNCTION_CALL'
    `, [accountId]);
    ctx.body = rows.map(({ receiver_account_id }) => receiver_account_id);
});

const findLikelyTokens = withPgClient(async (ctx) => {
    const { accountId } = ctx.params;
    const { client } = ctx;

    // TODO: Make sure indexer for explorer DB allows for faster way to do it in prod (see also above)
    const mintedWithBridge = `
        select distinct receiver_account_id from (
            select convert_from(decode(args->>'args_base64', 'base64'), 'UTF8')::json->>'account_id' as account_id, receiver_account_id
            from receipts
            join action_receipt_actions using (receipt_id)
            where action_kind = 'FUNCTION_CALL' and
                predecessor_account_id = $2 and
                args->>'method_name' = 'mint'
        ) minted_with_bridge
        where account_id = $1
    `;

    const calledByUser = `
        select distinct receiver_account_id from receipts
        join action_receipt_actions using (receipt_id)
        where predecessor_account_id = $1
            and action_kind = 'FUNCTION_CALL'
            and (args->>'method_name' like 'ft_%' or args->>'method_name' = 'storage_deposit')
    `;

    const { rows } = await client.query([mintedWithBridge, calledByUser].join(' union '), [accountId, BRIDGE_TOKEN_FACTORY_ACCOUNT_ID]);
    ctx.body = rows.map(({ receiver_account_id }) => receiver_account_id);
});

module.exports = {
    findStakingDeposits,
    findAccountActivity,
    findAccountsByPublicKey,
    findReceivers,
    findLikelyTokens,
};
