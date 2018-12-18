
const Koa = require('koa');
const app = new Koa();

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
const crypto2 = require('crypto2');

const base64ToIntArray = base64Str => {
    let data = Buffer.from(base64Str, 'base64');
    return Array.prototype.slice.call(data, 0)
};

const checkError = (ctx, response) => {
    if (response.error) {
        ctx.throw(400, `[${response.error.code}] ${response.error.message}: ${response.error.data}`);
    }
};

const ensureTrue = (boolValue) => {
    if (!boolValue) {
        ctx.throw(400, `Internal error`);
    }
}

const hash = async str => {
    let data = Buffer.from(await crypto2.hash.sha256(str), 'hex');
    return bs58.encode(data);
};

const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const signTransaction = async (transaction) => {
    const { stdout, stderr } = await execFile(
        '../nearcore/target/debug/keystore',
        ['sign_transaction', '--data', JSON.stringify(transaction)]);
    return JSON.parse(stdout);
};

const submit_transaction_rpc = async (client, method, args) => {
    const response = await client.request(method, [args])
    if (response.error) {
        return response
    }

    const transaction = response.result.body;
    return await client.request('submit_transaction', [await signTransaction(transaction)])
}

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const nonce = body.nonce || await getNonce(ctx, sender);
    console.log(`Deploying ${body.receiver} contract`);
    const contract_response = await submit_transaction_rpc(client, 'deploy_contract', {
        nonce: nonce,
        sender_account_id: await hash(sender),
        contract_account_id: await hash(body.receiver),
        wasm_byte_array: base64ToIntArray(body.contract),
        public_key: hardcodedKey.public_key
    })
    console.log("response", contract_response);
    checkError(ctx, contract_response);
    ctx.body = contract_response.result;
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const nonce = body.nonce || await getNonce(ctx, sender);
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    const response = await submit_transaction_rpc(client, 'schedule_function_call', {
        nonce: nonce,
        // TODO(#5): Need to make sure that big ints are supported later
        amount: parseInt(body.amount) || 0,
        originator_account_id: await hash(sender),
        contract_account_id: await encodeAccountNameForRpc(ctx.params.name),
        method_name: ctx.params.methodName,
        args: serializedArgs
    });
    checkError(ctx, response);
    console.log("response", response);
    ctx.body = response.result;
});

router.post('/contract/view/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const args = body.args || {};
    const serializedArgs =  Array.from(BSON.serialize(args));
    const response = await client.request('call_view_function', [{
        originator_id: await hash(hardcodedSender),
        contract_account_id: await encodeAccountNameForRpc(ctx.params.name),
        method_name: ctx.params.methodName,
        args: serializedArgs
    }]);
    checkError(ctx, response);
    ctx.body = BSON.deserialize(Uint8Array.from(response.result.result));
});

router.get('/account/:name', async ctx => {
    const response = await client.request('view_account', [{
        account_id: await encodeAccountNameForRpc(ctx.params.name),
        method_name: '',
        args: []
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

/**
 * Create a new account. Generate a throw away account id (UUID).
 */
router.post('/account', async ctx => {
    // TODO: this is using alice account to create all accounts. We may want to change that.
    const nonce = await getNonce(ctx, defaultSender);
    ensureTrue(nonce);
    const newAccountName = uuidV4();
    console.log("Creating new account " + newAccountName);

    // TODO: unhardcode key
    const createAccountParams = [{
        'nonce': nonce,
        'sender': await encodeAccountNameForRpc(defaultSender),
        'new_account_id': await encodeAccountNameForRpc(newAccountName),
        'amount': newAccountAmount,
        'public_key': hardcodedKey.public_key,
    }];
    const response = await client.request('create_account', createAccountParams);
    checkError(ctx, response);
    ctx.body = response.result;
});

/*
 * Helper to encode the account name in the format which is used in rpcs.
 */
async function encodeAccountNameForRpc(plainTextName){
    return hash(plainTextName)
}

async function getNonce(ctx, sender) {
    const response = await client.request('view_account', [{
        account_id: await hash(sender),
        method_name: '',
        args: []
    }]);
    checkError(ctx, response);
    return response.result.nonce + 1;
}

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT || 3000);
} else {
    module.exports = app;
}

