const { EmailDomainBlacklist } = require('../models');

const WRITE_TO_POSTGRES = true;

const EmailDomainBlacklistService = {
    getDomainBlacklistEntry(accountId) {
        return this.getDomainBlacklistEntry_sequelize(accountId);
    },

    async getDomainBlacklistEntry_sequelize(domainName) {
        const [entry] = await EmailDomainBlacklist.findOne({ where: { domainName } });
        return entry.toJSON();
    },

    async updateDomainBlacklistEntry(blacklistEntry) {
        const [postgresEntry] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.updateDomainBlacklistEntry_sequelize(blacklistEntry) : []),
        ]);

        return postgresEntry;
    },

    async updateDomainBlacklistEntry_sequelize(blacklistEntry) {
        const [entry] = await EmailDomainBlacklist.upsert(blacklistEntry);
        return entry.toJSON();
    },
};

module.exports = EmailDomainBlacklistService;
