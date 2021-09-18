const { isEntryStale } = require('./utils');

class EmailDomainValidator {
    constructor({
        blockTempEmailClient,
        emailDomainBlacklistDbClient
    }) {
        this.blockTempEmailClient = blockTempEmailClient;
        this.emailDomainBlacklistDbClient = emailDomainBlacklistDbClient;
    }

    async getDomainStatusFromDb(domainName) {
        try {
            return await this.emailDomainBlacklistDbClient.getDomainStatus(domainName);
        } catch (e) {
            console.warn('Failed to load domain blacklist entry from DB', e.message);
            return null;
        }
    }

    isValidationResultTrustworthy(entry) {
        if (!entry) { return false; }

        const {
            isTemporaryEmailService,
            hasValidDNSMXRecord,
            error
        } = entry;

        // `error` at this point always is 'invalid domain'
        if (error) { return false; }

        return !isTemporaryEmailService && !hasValidDNSMXRecord;
    }

    async isDomainValid(domainName) {
        // Try to get using DB client (it will use in memory cache)
        const domainStatusFromDb = await this.getDomainStatusFromDb(domainName);

        // We found a current entry in the db (or cached in memory)l return that!
        if (domainStatusFromDb && !isEntryStale(domainStatusFromDb)) {
            return this.isValidationResultTrustworthy(domainStatusFromDb);
        }

        // Entry is stale, no entry was found, or failed load from db and not cached in memory, load using BTE client
        try {
            const domainStatusFromAPI = await this.blockTempEmailClient.getDomainStatus(domainName);
            await this.emailDomainBlacklistDbClient.persistValidationResult(domainStatusFromAPI);
            return this.isValidationResultTrustworthy(domainStatusFromAPI);
        } catch (e) {
            // If fail to load using BTE client, return stale value anyway if we have it; better than nothing!
            return this.isValidationResultTrustworthy(domainStatusFromDb);
        }
    }
}

module.exports = EmailDomainValidator;