const SequelizeEmailDomainBlacklists = require('./sequelize/email_domain_blacklist');

const EmailDomainBlacklistService = {
    getDomainBlacklistEntry(domainName) {
        return SequelizeEmailDomainBlacklists.getDomainBlacklistEntry(domainName);
    },

    updateDomainBlacklistEntry(blacklistEntry) {
        return SequelizeEmailDomainBlacklists.updateDomainBlacklistEntry(blacklistEntry);
    },
};

module.exports = EmailDomainBlacklistService;
