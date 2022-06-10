const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const body = require('koa-json-body');
const cors = require('@koa/cors');

const {
    findAccountsByPublicKey,
    findStakingDeposits,
    findReceivers,
    findLikelyTokens,
    findLikelyNFTs,
    findStakingPools,
    findAccountActivity,
} = require('./src/middleware/indexer');

const app = new Koa();
const router = new Router();

// render.com passes requests through a proxy server; we need the source IPs to be accurate for `koa-ratelimit`
app.proxy = true;

app.use(logger());
app.use(body({ limit: '500kb', fallback: true }));
app.use(cors({ credentials: true }));

router.get('/health', (ctx) => {
    ctx.status = 200;
});

router.get('/publicKey/:publicKey/accounts', findAccountsByPublicKey);
router.get('/staking-deposits/:accountId', findStakingDeposits);
router.get('/account/:accountId/activity', findAccountActivity);
router.get('/account/:accountId/callReceivers', findReceivers);
router.get('/account/:accountId/likelyTokens', findLikelyTokens);
router.get('/account/:accountId/likelyNFTs', findLikelyNFTs);
router.get('/stakingPools', findStakingPools);

app
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(process.env.PORT);
