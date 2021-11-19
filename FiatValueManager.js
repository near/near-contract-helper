const superagent = require('superagent');
const Dataloader = require('dataloader');
const Cache = require('node-cache');

const ENABLE_DEBUG = false;
const debugLog = (...args) => ENABLE_DEBUG && console.log('FiatValueManager', ...args);

function wrapNodeCacheForDataloader(cache) {
    return {
        get: (...args) => {
            return cache.get(...args);
        },

        set: (...args) => {
            return cache.set(...args);
        },

        delete: (...args) => {
            return cache.del(...args);
        },

        clear: (...args) => {
            return cache.flushAll(...args);
        }

    };
}

class FiatValueManager {
    constructor({ nodeCache } = {}) {
        // 0 checkperiod means we only purge values from the cache on attempting to read an expired value
        // Which allows us to avoid having to call `.close()` on the cache to allow node to exit cleanly
        this.valueCache = nodeCache || new Cache({ stdTTL: 10, checkperiod: 0, useClones: false });
        this.fiatValueLoader = this.createFiatValueLoader(this.valueCache);
    }

    createFiatValueLoader(cache) {
        return new Dataloader(
            async (tokenIds) => {
                const prices = await this.fetchFiatValues(tokenIds);

                return tokenIds.map((id) => prices[id]);
            },
            {
                cacheMap: wrapNodeCacheForDataloader(cache)
            }
        );
    }

    async fetchFiatValues(tokenIds) {
        debugLog('fetchFiatValues()');

        const { body } = await superagent
            .get('https://api.coingecko.com/api/v3//simple/price')
            .set('Accept', 'application/json')
            .retry(3)
            .query({
                include_last_updated_at: true,
                vs_currencies: 'usd,eur,cny',
                ids: tokenIds.join(','),
            });

        return body;
    }

    async getPrice(tokens = ['near']) {
        debugLog('getPrice()', { tokens });

        const byTokenName = {};

        const prices = await this.fiatValueLoader.loadMany(tokens);
        tokens.forEach((tokenName, ndx) => byTokenName[tokenName] = prices[ndx]);

        return byTokenName;
    }
}

module.exports = FiatValueManager;