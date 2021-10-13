const SequelizeEmailDomainBlacklists = require('./sequelize/email_domain_blacklist');

const WRITE_TO_POSTGRES = true;

const EmailDomainBlacklistService = {
    getDomainBlacklistEntry(accountId) {
        return SequelizeEmailDomainBlacklists.getDomainBlacklistEntry(accountId);
    },

    async updateDomainBlacklistEntry(blacklistEntry) {
        const [postgresEntry] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeEmailDomainBlacklists.updateDomainBlacklistEntry(blacklistEntry)] : []),
        ]);

        return postgresEntry;
    },
};

module.exports = EmailDomainBlacklistService;
