
const Koa = require('koa');
const app = new Koa();

const createError = require('http-errors');
const body = require('koa-json-body');
const cors = require('@koa/cors');
const BSON = require('bsonfy').BSON;
const uuidV4 = require('uuid/v4');

const hardcodedKey = {
    public_key: '9AhWenZ3JddamBoyMqnTbp7yVbRuvqAv3zwfrWgfVRJE',
    secret_key: '2hoLMP9X2Vsvib2t4F1fkZHpFd6fHLr5q7eqGroRoNqdBKcPja2jCrmxW9uGBLXdTnbtZYibWe4NoFtB4Bk7LWg6'
};

const hardcodedSender = 'bob';
const defaultSender = 'alice.near';
const newAccountAmount = 5;

const MAX_RETRIES = 3;
const POLL_TIME_MS = 500;

app.use(require('koa-logger')());
// TODO: Check what limit means and set appropriate limit
app.use(body({ limit: '500kb', fallback: true }));
// TODO: Don't use CORS in production on studio.nearprotocol.com
app.use(cors({ credentials: true }));


const Router = require('koa-router');
const router = new Router();

const superagent = require('superagent');

const bs58 = require('bs58');
const crypto = require('crypto');

const InMemoryKeyStore = require('nearlib/test-tools/in_memory_key_store.js');
const LocalNodeConnection = require('nearlib/local_node_connection');
const NearClient = require('nearlib/nearclient');
const keyStore = new InMemoryKeyStore();
keyStore.setKey(defaultSender, hardcodedKey);
const localNodeConnection = new LocalNodeConnection('http://localhost:3030');
const nearClient = new NearClient(keyStore, localNodeConnection);
const Account = require('nearlib/account');
const account = new Account(nearClient);

const base64ToIntArray = base64Str => {
    let data = Buffer.from(base64Str, 'base64');
    return Array.prototype.slice.call(data, 0);
};

const sha256 = data => {
    const hash = crypto.createHash('sha256');
    hash.update(data, 'utf8');
    return hash.digest();
};

const request = async (methodName, params) => {
    try {
        const response = await superagent
            .post(`http://localhost:3030/${methodName}`)
            .use(require('superagent-logger'))
            .send(params);
        return JSON.parse(response.text);
    } catch(e) {
        console.error('request error:', e.response.text);
        throw e;
    }
};

const viewAccount = async senderHash => {
    return await request('view_account', {
        account_id: senderHash,
    });
};

const getNonce = async senderHash => {
    return (await viewAccount(senderHash)).nonce + 1;
};

const sleep = timeMs => {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, timeMs);
    });
};

const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const signTransaction = async (transaction) => {
    const stringifiedTxn = JSON.stringify(transaction);
    const { stdout, stderr } = await execFile(
        '../nearcore/target/debug/keystore',
        ['sign_transaction',
            '--data', stringifiedTxn,
            '--keystore-path', '../nearcore/keystore/'
        ]);
    return JSON.parse(stdout);
};

const submitTransaction = async (method, args) => {
    // TODO: Make sender param names consistent
    // TODO: https://github.com/nearprotocol/nearcore/issues/287
    const senderKeys = ['sender_account_id', 'originator_account_id', 'originator_id', 'sender'];
    const sender = senderKeys.map(key => args[key]).find(it => !!it);
    const nonce = await getNonce(sender);

    for (let i = 0; i < MAX_RETRIES; i++) {
        const response = await request(method, Object.assign({}, args, { nonce }));

        const transaction = response.body;
        const submitResponse = await request('submit_transaction', await signTransaction(transaction));
        await sleep(POLL_TIME_MS);

        // TODO: Don't hardcode special check for deploy once it works same as other calls
        if (method == 'deploy_contract') {
            const contractHash = bs58.encode(sha256(Buffer.from(args.wasm_byte_array)));
            const accountInfo = await viewAccount(args.contract_account_id);
            if (accountInfo.code_hash == contractHash) {
                return accountInfo;
            }
            continue;
        }

        const accountInfo = await viewAccount(sender);
        if (accountInfo.nonce >= nonce) {
            // TODO: Use better check when it's available:
            // TODO: https://github.com/nearprotocol/nearcore/issues/276
            return accountInfo;
        }
    }
    throw createError(504, `Transaction not accepted after ${MAX_RETRIES} retries`);
};

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    ctx.body = await submitTransaction('deploy_contract', {
        originator: sender,
        contract_account_id: body.receiver,
        wasm_byte_array: base64ToIntArray(body.contract),
        public_key: hardcodedKey.public_key
    });
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    ctx.body = await submitTransaction('schedule_function_call', {
        // TODO(#5): Need to make sure that big ints are supported later
        amount: parseInt(body.amount) || 0,
        originator: sender,
        contract_account_id: ctx.params.name,
        method_name: ctx.params.methodName,
        args: serializedArgs
    });
});

router.post('/contract/view/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    const response = await request('call_view_function', {
        originator: hardcodedSender,
        contract_account_id: ctx.params.name,
        method_name: ctx.params.methodName,
        args: serializedArgs
    });
    ctx.body = BSON.deserialize(Uint8Array.from(response.result));
});

router.get('/account/:name', async ctx => {
    ctx.body = await viewAccount(ctx.params.name);
});

/**
 * Create a new account. Generate a throw away account id (UUID).
 * Returns account name and public/private key.
 */
router.post('/account', async ctx => {
    // TODO: this is using alice account to create all accounts. We may want to change that.
    const newAccountName = uuidV4();

    const createAccountResponse =
        await account.createAccountWithRandomKey(newAccountName, 1, defaultSender);
    createAccountResponse['accountName'] = newAccountName;
    ctx.body = createAccountResponse;
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT || 3000);
} else {
    module.exports = app;
}
