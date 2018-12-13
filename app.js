
const Koa = require('koa');
const app = new Koa();

const body = require('koa-json-body')
const cors = require('@koa/cors');

const hardcodedKey = {
    "public_key":"9AhWenZ3JddamBoyMqnTbp7yVbRuvqAv3zwfrWgfVRJE",
    "secret_key":"2hoLMP9X2Vsvib2t4F1fkZHpFd6fHLr5q7eqGroRoNqdBKcPja2jCrmxW9uGBLXdTnbtZYibWe4NoFtB4Bk7LWg6"
};

const hardcodedSender = "bob";

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
        ctx.throw(400, `[${response.error.code}] ${response.error.message}`);
    }
};

const hash = async str => {
    let data = Buffer.from(await crypto2.hash.sha256(str), 'hex');
    return bs58.encode(data);
};

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const nonce = body.nonce || await getNonce(ctx, sender);
    console.log(`Deploing ${body.receiver} contract`);
    const response = await client.request('deploy_contract', [{
        nonce: nonce,
        sender_account_id: await hash(sender),
        contract_account_id: await hash(body.receiver),
        wasm_byte_array: base64ToIntArray(body.contract),
        public_key: hardcodedKey.public_key
    }]);
    checkError(ctx, response);
    console.log("response", response);
    // TODO(#2): Sign transactions.
    const res = await client.request('submit_transaction', [{
        body: response.result.body,
        sender_sig: [147, 237, 206, 27, 8, 112, 190, 228, 129, 23, 111, 153, 134, 68, 203, 152, 108, 105, 112, 238, 171, 200, 158, 83, 197, 20, 158, 214, 151, 190, 92, 135, 33, 158, 42, 159, 131, 80, 96, 201, 185, 254, 213, 46, 209, 11, 158, 2, 57, 161, 66, 222, 87, 192, 141, 53, 43, 198, 40, 107, 148, 218, 231, 7],
    }]);
    console.log("response", res);
    ctx.body = res.result;
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || hardcodedSender;
    const nonce = body.nonce || await getNonce(ctx, sender);
    const response = await client.request('schedule_function_call', [{
        nonce: nonce,
        originator_account_id: await hash(sender),
        contract_account_id: await hash(ctx.params.name),
        method_name: ctx.params.methodName,
        args: [body.args]
    }]);
    checkError(ctx, response);
    // TODO(#2): Sign transactions.
    const res = await client.request('submit_transaction', [{
        body: response.result.body,
        sender_sig: [147, 237, 206, 27, 8, 112, 190, 228, 129, 23, 111, 153, 134, 68, 203, 152, 108, 105, 112, 238, 171, 200, 158, 83, 197, 20, 158, 214, 151, 190, 92, 135, 33, 158, 42, 159, 131, 80, 96, 201, 185, 254, 213, 46, 209, 11, 158, 2, 57, 161, 66, 222, 87, 192, 141, 53, 43, 198, 40, 107, 148, 218, 231, 7],
    }]);
    console.log("response", res);
    ctx.body = res.result;
});

router.post('/contract/view/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const response = await client.request('call_view_function', [{
        contract_account_id: await hash(ctx.params.name),
        method_name: ctx.params.methodName,
        args: [body.args]
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

router.get('/account/:name', async ctx => {
    const response = await client.request('view_account', [{
        account_id: await hash(ctx.params.name),
        method_name: '',
        args: []
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

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

