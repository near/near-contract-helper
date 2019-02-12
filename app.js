
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
        console.log("Error: ", e);
        if (e.response) {
            ctx.throw(e.response.status, e.response.text);
        }
        throw e;
    }
});

const Router = require('koa-router');
const router = new Router();

const { KeyPair, InMemoryKeyStore, SimpleKeyStoreSigner, LocalNodeConnection, NearClient, Near, Account } = require('nearlib');
const defaultSender = 'alice.near';
const rawKey = JSON.parse(require('fs').readFileSync(`./${defaultSender}.json`));
const defaultKey = new KeyPair(rawKey.public_key, rawKey.secret_key);
const keyStore = new InMemoryKeyStore();
keyStore.setKey(defaultSender, defaultKey);
const localNodeConnection = new LocalNodeConnection('http://localhost:3030');
const nearClient = new NearClient(new SimpleKeyStoreSigner(keyStore), localNodeConnection);
const near = new Near(nearClient);

const account = new Account(nearClient);
const NEW_ACCOUNT_AMOUNT = 100;

const viewAccount = accountId => {
    return account.viewAccount(accountId);
};

router.post('/contract', async ctx => {
    const body = ctx.request.body;
    ctx.body = await near.waitForTransactionResult(
        await near.deployContract(body.receiver, Buffer.from(body.contract, 'base64')));
});

router.post('/contract/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const sender = body.sender || defaultSender;
    const args = body.args || {};
    ctx.body = await near.waitForTransactionResult(
        await near.scheduleFunctionCall(parseInt(body.amount) || 0, sender, ctx.params.name, ctx.params.methodName, args));
});

router.post('/contract/view/:name/:methodName', async ctx => {
    const body = ctx.request.body;
    const args = body.args || {};
    ctx.body = await near.callViewFunction(defaultSender, ctx.params.name, ctx.params.methodName, args);
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
    const body = ctx.request.body;
    const newAccountId = body.newAccountId;
    // TODO: we should find a way to store the key pair for the new account
    await near.waitForTransactionResult(
        await account.createAccount(newAccountId, defaultKey.getPublicKey(), NEW_ACCOUNT_AMOUNT, defaultSender));
    const response = {
        account_id: newAccountId
    };
    keyStore.setKey(newAccountId, defaultKey);
    ctx.body = response;
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT || 3000);
} else {
    module.exports = app;
}
