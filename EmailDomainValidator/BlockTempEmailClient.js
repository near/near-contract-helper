const Cache = require('node-cache');
const superagent = require('superagent');

const { getStaleDate: getStaleDateUtil } = require('./utils');

const API_ENDPOINT_URL_BASE = 'https://block-temporary-email.com/check';
const API_ENDPOINT_URL_DOMAIN = `${API_ENDPOINT_URL_BASE}/domain`;

class BlockTempEmailClient {
    constructor({
        API_KEY,
        // 12H hour cache window so multiple attempts for the same domain are immediate
        cache = new Cache({ stdTTL: 60 * 60 * 12, checkperiod: 0, useClones: false }),
        request = superagent,
        getStaleDate = getStaleDateUtil
    }) {
        this.request = request;
        this.cache = cache;
        this.API_KEY = API_KEY;
        this.getStaleDate = getStaleDate;
    }

    async getValidationResultFromAPI(domainName) {
        try {
            const {
                body: {
                    temporary: isTemporaryEmailService,
                    dns: hasValidDNSMXRecord,
                    error
                }
            } = await this.request
                .get(`${API_ENDPOINT_URL_DOMAIN}/${domainName}`)
                .set('x-api-key', this.API_KEY);

            const validationResult = {
                isTemporaryEmailService,
                hasValidDNSMXRecord,
                error,
                staleAt: this.getStaleDate(Date.now())
            };

            // Only cache in memory for un-stale entries so, calling code knows to re-fetch
            this.cache.set(domainName, validationResult);

            return validationResult;
        } catch (e) {
            console.warn('Failed to load validation result from BTE API', e.message);
            return null;
        }
    }

    async getDomainStatus(domainName) {
        return this.cache.get(domainName) || await this.getValidationResultFromAPI(domainName);
    }
}

module.exports = BlockTempEmailClient;