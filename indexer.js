const Koa = require('koa');
const Router = require('koa-router');
const body = require('koa-json-body');
const cors = require('@koa/cors');
const koaBunyanLogger = require('koa-bunyan-logger');

const {
    findAccountsByPublicKey,
    findStakingDeposits,
    findReceivers,
    findLikelyTokens,
    findLikelyTokensFromBlock,
    findLikelyNFTs,
    findLikelyNFTsFromBlock,
    findStakingPools,
    findAccountActivity,
} = require('./src/middleware/indexer');

const app = new Koa();
const router = new Router();

// render.com passes requests through a proxy server; we need the source IPs to be accurate for `koa-ratelimit`
app.proxy = true;

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());
app.use(koaBunyanLogger.requestLogger());

app.use(body({ limit: '500kb', fallback: true }));
app.use(cors());

router.get('/health', (ctx) => {
    ctx.status = 200;
});

router.get('/publicKey/:publicKey/accounts', findAccountsByPublicKey);
router.get('/staking-deposits/:accountId', findStakingDeposits);
router.get('/account/:accountId/activity', findAccountActivity);
router.get('/account/:accountId/callReceivers', findReceivers);
router.get('/account/:accountId/likelyTokens', findLikelyTokens);
router.get('/account/:accountId/likelyNFTs', findLikelyNFTs);
router.get('/account/:accountId/likelyTokensFromBlock', findLikelyTokensFromBlock);
router.get('/account/:accountId/likelyNFTsFromBlock', findLikelyNFTsFromBlock);
router.get('/stakingPools', findStakingPools);

app
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(process.env.PORT);
