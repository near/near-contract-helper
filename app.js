
const Koa = require('koa');
const app = new Koa();

const body = require('koa-json-body')
const cors = require('@koa/cors');

// TODO: Check what limit means and set appropriate limit
app.use(body({ limit: '500kb', fallback: true }))
// TODO: Limit CORS to studio.nearprotocol.com
app.use(cors());

const Router = require('koa-router');
const router = new Router();

var jayson = require('jayson/promise');
var client = jayson.client.http({
    headers: {
        'Content-Type': 'application/json'
    },
    port: 3030
});

const base64ToIntArray = base64Str => {
    let data = Buffer.from(base64Str, 'base64');
    return Array.prototype.slice.call(data, 0)
};

const hexToIntArray = hexStr => {
    let data = Buffer.from(hexStr, 'hex');
    return Array.prototype.slice.call(data, 0)
};

const checkError = (ctx, response) => {
    if (response.error) {
        ctx.throw(400, response.error.message);
    }
};

const hash = async str => {
    return hexToIntArray(await require('crypto2').hash.sha256(str));
}

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    const x = await hash(body.sender);
    const response = await client.request('receive_transaction', [{
        nonce: body.nonce,
        sender: await hash(body.sender),
        receiver: await hash(body.receiver),
        amount: 0,
        method_name: 'deploy',
        args: [base64ToIntArray(body.contract)]
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

router.post('/contract/:methodName', async ctx => {
    const body = ctx.request.body;
    const response = await client.request('receive_transaction', [{
        nonce: body.nonce,
        sender: await hash(body.sender),
        receiver: await hash(body.receiver),
        amount: 0,
        method_name: ctx.params.methodName,
        args: [body.args]
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

router.get('/account/:name', async ctx => {
    const response = await client.request('view', [{
        account: await hash(ctx.params.name),
        method_name: '',
        args: []
    }]);
    checkError(ctx, response);
    ctx.body = response.result;
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(3000);
} else {
    module.exports = app;
}

