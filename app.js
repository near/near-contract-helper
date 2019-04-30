const Koa = require('koa');
const app = new Koa();

const body = require('koa-json-body');
const cors = require('@koa/cors');

app.use(require('koa-logger')());
// TODO: Check what limit means and set appropriate limit
app.use(body({ limit: '500kb', fallback: true }));
// TODO: Don't use CORS in production on studio.nearprotocol.com
app.use(cors({ credentials: true }));

// Middleware to passthrough HTTP errors from node
app.use(async function(ctx, next) {
    try {
        await next();
    } catch(e) {
        console.log('Error: ', e);
        if (e.response) {
            ctx.throw(e.response.status, e.response.text);
        }
        throw e;
    }
});

const Router = require('koa-router');
const router = new Router();

const { KeyPair, InMemoryKeyStore, SimpleKeyStoreSigner, LocalNodeConnection, NearClient, Near, Account } = require('nearlib');
const defaultSender = process.env.NEAR_CONTRACT_HELPER_DEFAULT_SENDER || 'alice.near';
let publicKey, secretKey;
if (process.env.NEAR_CONTRACT_HELPER_PUBLIC_KEY && process.env.NEAR_CONTRACT_HELPER_SECRET_KEY) {
    publicKey = process.env.NEAR_CONTRACT_HELPER_PUBLIC_KEY;
    secretKey = process.env.NEAR_CONTRACT_HELPER_SECRET_KEY;
} else {
    const rawKey = JSON.parse(require('fs').readFileSync(`./keystore/${defaultSender}.json`));
    publicKey = rawKey.public_key;
    secretKey = rawKey.secret_key;
}
const defaultKey = new KeyPair(publicKey, secretKey);
const keyStore = new InMemoryKeyStore();
keyStore.setKey(defaultSender, defaultKey);
const localNodeConnection = new LocalNodeConnection(process.env.NEAR_CONTRACT_HELPER_NODE_URL || 'http://localhost:3030');
const nearClient = new NearClient(new SimpleKeyStoreSigner(keyStore), localNodeConnection);
const near = new Near(nearClient);

const account = new Account(nearClient);
const NEW_ACCOUNT_AMOUNT = 100;

router.post('/account', async ctx => {
    const body = ctx.request.body;
    const newAccountId = body.newAccountId;
    const newAccountPublicKey = body.newAccountPublicKey;
    await near.waitForTransactionResult(
        await account.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT, defaultSender));
    const response = {
        account_id: newAccountId
    };
    ctx.body = response;
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.NEAR_CONTRACT_HELPER_PORT || process.env.PORT || 3000);
} else {
    module.exports = app;
}
