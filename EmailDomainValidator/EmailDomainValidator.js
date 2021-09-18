const debug = require('debug');

const { isEntryStale } = require('./utils');

class EmailDomainValidator {
    constructor({
        blockTempEmailClient,
        emailDomainBlacklistDbClient
    }) {
        this.blockTempEmailClient = blockTempEmailClient;
        this.emailDomainBlacklistDbClient = emailDomainBlacklistDbClient;
        this.debugLog = debug('EmailDomainValidator');
    }

    async getDomainStatusFromDb(domainName) {
        const normalizeDomainName = domainName.toLowerCase();
        this.debugLog('getDomainStatusFromDb', normalizeDomainName);

        try {
            return await this.emailDomainBlacklistDbClient.getDomainStatus(normalizeDomainName);
        } catch (e) {
            console.warn('Failed to load domain blacklist entry from DB:', e.message);
            return null;
        }
    }

    isValidationResultTrustworthy(entry) {
        this.debugLog('isValidationResultTrustworthy', entry);

        if (!entry) { return false; }

        const {
            isTemporaryEmailService,
            hasValidDNSMXRecord,
            error
        } = entry;

        // `error` at this point always is 'invalid domain'
        if (error) { return false; }

        return !isTemporaryEmailService && hasValidDNSMXRecord;
    }

    async isDomainValid(domainName) {
        const normalizeDomainName = domainName.toLowerCase();
        // Try to get using DB client (it will use in memory cache)
        const domainStatusFromDb = await this.getDomainStatusFromDb(normalizeDomainName);

        this.debugLog('isDomainValid/domainStatusFromDb', domainStatusFromDb);

        // We found a current entry in the db (or cached in memory)l return that!
        if (domainStatusFromDb && !isEntryStale(domainStatusFromDb)) {
            this.debugLog('Found entry in DB (or in memory cache');
            return this.isValidationResultTrustworthy(domainStatusFromDb);
        }

        // Entry is stale, no entry was found, or failed load from db and not cached in memory, load using BTE client
        try {
            const domainStatusFromAPI = await this.blockTempEmailClient.getDomainStatus(normalizeDomainName);
            this.debugLog('isDomainValid/domainStatusFromAPI', domainStatusFromAPI);

            await this.emailDomainBlacklistDbClient.persistValidationResult({ domainName: normalizeDomainName, ...domainStatusFromAPI });
            return this.isValidationResultTrustworthy(domainStatusFromAPI);
        } catch (e) {
            console.warn('failed to load using BTE or persist', e);
            // If fail to load using BTE client, return stale value anyway if we have it; better than nothing!
            return this.isValidationResultTrustworthy(domainStatusFromDb);
        }
    }
}

module.exports = EmailDomainValidator;