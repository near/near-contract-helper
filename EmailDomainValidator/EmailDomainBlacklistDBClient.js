const Cache = require('node-cache');

const { EmailDomainBlacklist } = require('../models');
const { getStaleDate: getStaleDateUtil, isEntryStale } = require('./utils');

class EmailDomainBlacklistDBClient {
    constructor({
        cache = new Cache({ stdTTL: 60 * 60 * 12, checkperiod: 0, useClones: false }),
        getStaleDate = getStaleDateUtil
    }) {
        this.cache = cache;
        this.getStaleDate = getStaleDate;
    }

    async persistValidationResult(validationResult) {
        const blacklistEntry = await EmailDomainBlacklist.upsert({
            staleAt: this.getStaleDate(Date.now()), // Allow caller to override
            ...validationResult
        });

        this.cache.set(validationResult.domainName, blacklistEntry);

        return blacklistEntry;
    }

    async getValidationResultFromDB(domainName) {
        let domainBlacklistEntry;

        try {
            domainBlacklistEntry = await EmailDomainBlacklist.findOne({ where: { domainName } });

            // Only cache in memory for un-stale entries so, calling code knows to re-fetch
            if (domainBlacklistEntry && !isEntryStale(domainBlacklistEntry)) {
                this.cache.set(domainName, domainBlacklistEntry);
            }
        } catch (e) {
            console.warn('Failed to load entry from DB', e.message);
        }

        return domainBlacklistEntry;
    }

    async getDomainStatus(domainName) {
        return this.cache.get(domainName) || await this.getValidationResultFromDB(domainName);
    }
}

module.exports = EmailDomainBlacklistDBClient;