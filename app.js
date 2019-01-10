
const Koa = require('koa');
const app = new Koa();

const createError = require('http-errors');
const body = require('koa-json-body');
const cors = require('@koa/cors');
const uuidV4 = require('uuid/v4');

const hardcodedKey = {
    public_key: '9AhWenZ3JddamBoyMqnTbp7yVbRuvqAv3zwfrWgfVRJE',
    secret_key: '2hoLMP9X2Vsvib2t4F1fkZHpFd6fHLr5q7eqGroRoNqdBKcPja2jCrmxW9uGBLXdTnbtZYibWe4NoFtB4Bk7LWg6'
};

const defaultSender = 'alice.near';

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
        console.error('request error:', e.response ? e.response.text : e);
        throw e
    }
};

const viewAccount = async senderHash => {
    return await request('view_account', {
        account_id: senderHash,
    });
};

const submitTransaction = nearClient.submitTransaction.bind(nearClient);

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || defaultSender;
    ctx.body = await submitTransaction('deploy_contract', {
        originator: sender,
        contract_account_id: body.receiver,
        wasm_byte_array: base64ToIntArray(body.contract),
        public_key: hardcodedKey.public_key
    });
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || defaultSender;
    const args = body.args || {};
    const serializedArgs =  Array.from(Buffer.from(JSON.stringify(args)));
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
    const serializedArgs =  Array.from(Buffer.from(JSON.stringify(args)));
    const response = await request('call_view_function', {
        originator: defaultSender,
        contract_account_id: ctx.params.name,
        method_name: ctx.params.methodName,
        args: serializedArgs
    });
    ctx.body = JSON.parse(Buffer.from(response.result).toString());
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
    createAccountResponse["account_id"] = newAccountName;
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
