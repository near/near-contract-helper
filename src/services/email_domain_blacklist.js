const {
    getEmailDomainBlacklistEntry,
    updateEmailDomainBlacklistEntry,
} = require('../db/methods/email_domain_blacklist');


class EmailDomainBlacklistService {
    constructor(params = {
        db: {
            getEmailDomainBlacklistEntry,
            updateEmailDomainBlacklistEntry,
        },
    }) {
        this.db = params.db;
    }

    getDomainBlacklistEntry(domainName) {
        return this.db.getEmailDomainBlacklistEntry(domainName);
    }

    updateDomainBlacklistEntry(blacklistEntry) {
        const { domainName, ...entry } = blacklistEntry;
        return this.db.updateEmailDomainBlacklistEntry({ domainName }, entry);
    }
}

module.exports = EmailDomainBlacklistService;
