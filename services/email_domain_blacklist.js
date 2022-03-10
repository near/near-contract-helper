const {
    getEmailDomainBlacklistEntry,
    updateEmailDomainBlacklistEntry,
} = require('../db/methods/email_domain_blacklist');
const { USE_DYNAMODB } = require('../features');
const SequelizeEmailDomainBlacklists = require('./sequelize/email_domain_blacklist');


class EmailDomainBlacklistService {
    constructor(params = {
        db: {
            getEmailDomainBlacklistEntry,
            updateEmailDomainBlacklistEntry,
        },
        sequelize: SequelizeEmailDomainBlacklists,
    }) {
        this.db = params.db;
        this.sequelize = params.sequelize;
    }

    getDomainBlacklistEntry(domainName) {
        if (!USE_DYNAMODB) {
            return this.sequelize.getDomainBlacklistEntry(domainName);
        }
        return this.db.getEmailDomainBlacklistEntry(domainName);
    }

    updateDomainBlacklistEntry(blacklistEntry) {
        if (!USE_DYNAMODB) {
            return this.sequelize.updateDomainBlacklistEntry(blacklistEntry);
        }
        const { domainName, ...entry } = blacklistEntry;
        return this.db.updateEmailDomainBlacklistEntry({ domainName }, entry);
    }
}

module.exports = EmailDomainBlacklistService;
