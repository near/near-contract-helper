
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

const convertToIntArray = base64Str => {
    let data = Buffer.from(base64Str, 'base64');
    return Array.prototype.slice.call(data, 0)
};

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    ctx.body = await client.request('receive_transaction', [{
        nonce: body.nonce,
        sender: body.sender,
        receiver: body.receiver,
        amount: 0,
        method_name: 'deploy',
        args: [convertToIntArray(body.contract)]
    }]);
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(3000);
} else {
    module.exports = app;
}

