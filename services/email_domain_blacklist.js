const { EmailDomainBlacklist } = require('../models');

const WRITE_TO_POSTGRES = true;

const EmailDomainBlacklistService = {
    getDomainBlacklistEntry(accountId) {
        return this.getDomainBlacklistEntry_sequelize(accountId);
    },

    async getDomainBlacklistEntry_sequelize(domainName) {
        const [account] = await EmailDomainBlacklist.findOne({ where: { domainName } });
        return account.toJSON();
    },

    updateDomainBlacklistEntry(blacklistEntry) {
        return ([
            ...(WRITE_TO_POSTGRES ? this.updateDomainBlacklistEntry_sequelize(blacklistEntry) : []),
        ]);
    },

    async updateDomainBlacklistEntry_sequelize(blacklistEntry) {
        const [entry] = await EmailDomainBlacklist.upsert(blacklistEntry);
        return entry;
    },
};

module.exports = EmailDomainBlacklistService;
