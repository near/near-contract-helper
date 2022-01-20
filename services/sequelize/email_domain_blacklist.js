const { EmailDomainBlacklist } = require('../../models');

const SequelizeEmailDomainBlacklist = {
    async getDomainBlacklistEntry(domainName) {
        const entry = await EmailDomainBlacklist.findOne({ where: { domainName } });
        return entry.toJSON();
    },

    async updateDomainBlacklistEntry(blacklistEntry) {
        const [entry] = await EmailDomainBlacklist.upsert(blacklistEntry);
        return entry.toJSON();
    },
};

module.exports = SequelizeEmailDomainBlacklist;
