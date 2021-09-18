const Cache = require('node-cache');
const superagent = require('superagent');

const API_ENDPOINT_URL_BASE = 'https://block-temporary-email.com/check';
const API_ENDPOINT_URL_DOMAIN = `${API_ENDPOINT_URL_BASE}/domain`;

class BlockTempEmailClient {
    constructor({
        API_KEY,
        // 12H hour cache window so multiple attempts for the same domain are immediate
        cache = new Cache({ stdTTL: ((60 * 1000) * 60) * 12, checkperiod: 0, useClones: false }),
        request = superagent,
    }) {
        this.request = request;
        this.cache = cache;
        this.API_KEY = API_KEY;
    }

    async validateDomainWithAPI(domainName) {
        const { body: validationResult } = await this.request
            .get(`${API_ENDPOINT_URL_DOMAIN}/${domainName}`)
            .set('x-api-key', this.API_KEY);

        return validationResult;
    }

    async isDomainValid(domainName) {
        try {
            const validationResult = await this.cache.get(domainName) || this.validateDomainWithAPI(domainName);

            this.cache.set(domainName, validationResult); // Resets TTL

            const {
                temporary: isTemporaryEmailService,
                dns: hasValidMXDNSEntry,
                status
            } = validationResult;

            // Non-200 code means 'invalid domain'
            if (status !== 200) { return false; }

            return !isTemporaryEmailService && !hasValidMXDNSEntry;
        } catch (err) {
            console.log('Attempt to validate #{domainName} failed.', err.message);
            return false;
        }
    }
}

module.exports = BlockTempEmailClient;