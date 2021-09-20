const debug = require('debug');
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
        this.debugLog = debug('EmailDomainBlacklistDBClient');
    }

    async persistValidationResult(validationResult) {
        this.debugLog('persistValidationResult', validationResult);

        const [blacklistEntry] = await EmailDomainBlacklist.upsert({
            staleAt: this.getStaleDate(Date.now()), // Allow caller to override
            ...validationResult
        });

        this.cache.set(validationResult.domainName, blacklistEntry);

        return blacklistEntry;
    }

    async getValidationResultFromDB(domainName) {
        const normalizeDomainName = domainName.toLowerCase();

        this.debugLog('getValidationResultFromDB');

        let domainBlacklistEntry;

        try {
            domainBlacklistEntry = await EmailDomainBlacklist.findOne({ where: { normalizeDomainName } });

            // Only cache in memory for un-stale entries so, calling code knows to re-fetch
            if (domainBlacklistEntry && !isEntryStale(domainBlacklistEntry)) {
                this.cache.set(normalizeDomainName, domainBlacklistEntry);
            }
        } catch (e) {
            console.warn('Failed to load entry from DB', e.message);
        }

        return domainBlacklistEntry;
    }

    async getDomainStatus(domainName) {
        const normalizeDomainName = domainName.toLowerCase();

        this.debugLog('getDomainStatus');

        return this.cache.get(normalizeDomainName) || await this.getValidationResultFromDB(normalizeDomainName);
    }
}

module.exports = EmailDomainBlacklistDBClient;