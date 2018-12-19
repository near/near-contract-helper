
const Koa = require('koa');
const app = new Koa();

const createError = require('http-errors')
const body = require('koa-json-body')
const cors = require('@koa/cors');
const BSON = require('bsonfy').BSON;
const uuidV4 = require('uuid/v4');

const hardcodedKey = {
    "public_key":"9AhWenZ3JddamBoyMqnTbp7yVbRuvqAv3zwfrWgfVRJE",
    "secret_key":"2hoLMP9X2Vsvib2t4F1fkZHpFd6fHLr5q7eqGroRoNqdBKcPja2jCrmxW9uGBLXdTnbtZYibWe4NoFtB4Bk7LWg6"
};

const hardcodedSender = "bob";
const defaultSender = "alice";
const newAccountAmount = 5;

const MAX_RETRIES = 3;
const POLL_TIME_MS = 500;

app.use(require('koa-logger')());
// TODO: Check what limit means and set appropriate limit
app.use(body({ limit: '500kb', fallback: true }))
// TODO: Don't use CORS in production on studio.nearprotocol.com
app.use(cors({ credentials: true }));


const Router = require('koa-router');
const router = new Router();

var jayson = require('jayson/promise');
var client = jayson.client.http({
    headers: {
        'Content-Type': 'application/json'
    },
    port: 3030
});

const bs58 = require('bs58');
const crypto = require('crypto');

const base64ToIntArray = base64Str => {
    let data = Buffer.from(base64Str, 'base64');
    return Array.prototype.slice.call(data, 0)
};

const checkError = (response) => {
    if (response.error) {
        throw createError(400, `[${response.error.code}] ${response.error.message}: ${response.error.data}`);
    }
    return response;
};

const sha256 = data => {
    const hash = crypto.createHash('sha256');
    hash.update(data, 'utf8');
    return hash.digest();
}

const accountHash = async str => {
    return bs58.encode(sha256(str));
};

const viewAccount = async senderHash => {
    return checkError(await client.request('view_account', [{
        account_id: senderHash,
        method_name: '',
        args: []
    }])).result;
}

const getNonce = async senderHash => {
    return (await viewAccount(senderHash)).nonce + 1;
}

const sleep = timeMs => {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, timeMs);
    });
}

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
    const sender = senderKeys.map(key => args[key]).find(it => !!it)
    const nonce = await getNonce(sender);
    const callList = [Object.assign({}, args, { nonce })];

    for (let i = 0; i < MAX_RETRIES; i++) {
        const response = await client.request(method, callList);
        checkError(response);

        const transaction = response.result.body;
        const submitResponse = await client.request('submit_transaction', [await signTransaction(transaction)]);
        checkError(submitResponse);
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
}

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    ctx.body = await submitTransaction('deploy_contract', {
        sender_account_id: await accountHash(sender),
        contract_account_id: await accountHash(body.receiver),
        wasm_byte_array: base64ToIntArray(body.contract),
        public_key: hardcodedKey.public_key
    })
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    ctx.body = await submitTransaction('schedule_function_call', {
        // TODO(#5): Need to make sure that big ints are supported later
        amount: parseInt(body.amount) || 0,
        originator_account_id: await accountHash(sender),
        contract_account_id: await accountHash(ctx.params.name),
        method_name: ctx.params.methodName,
        args: serializedArgs
    });
});

router.post('/contract/view/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    const response = await client.request('call_view_function', [{
        originator_id: await accountHash(hardcodedSender),
        contract_account_id: await accountHash(ctx.params.name),
        method_name: ctx.params.methodName,
        args: serializedArgs
    }]);
    checkError(response);
    ctx.body = BSON.deserialize(Uint8Array.from(response.result.result));
});

router.get('/account/:name', async ctx => {
    ctx.body = await viewAccount(accountHash(ctx.params.name));
});

/**
 * Create a new account. Generate a throw away account id (UUID).
 */
router.post('/account', async ctx => {
    // TODO: this is using alice account to create all accounts. We may want to change that.
    const newAccountName = uuidV4();
    console.log("Creating new account " + newAccountName);

    // TODO: unhardcode key
    const createAccountParams = {
        sender: await accountHash(defaultSender),
        new_account_id: await accountHash(newAccountName),
        amount: newAccountAmount,
        public_key: hardcodedKey.public_key,
    };

    ctx.body = await submitTransaction("create_account", createAccountParams);
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT || 3000);
} else {
    module.exports = app;
}

