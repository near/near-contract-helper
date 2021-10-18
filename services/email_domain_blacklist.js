const SequelizeEmailDomainBlacklists = require('./sequelize/email_domain_blacklist');

const EmailDomainBlacklistService = {
    getDomainBlacklistEntry(accountId) {
        return SequelizeEmailDomainBlacklists.getDomainBlacklistEntry(accountId);
    },

    updateDomainBlacklistEntry(blacklistEntry) {
        return SequelizeEmailDomainBlacklists.updateDomainBlacklistEntry(blacklistEntry);
    },
};

module.exports = EmailDomainBlacklistService;
