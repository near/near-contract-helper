const stampit = require('@stamp/it');

const {
    getEmailDomainBlacklistEntry,
    updateEmailDomainBlacklistEntry,
} = require('../db/methods/email_domain_blacklist');


const EmailDomainBlacklistService = stampit({
    props: {
        db: {
            getEmailDomainBlacklistEntry,
            updateEmailDomainBlacklistEntry,
        },
    },
    methods: {
        getDomainBlacklistEntry(domainName) {
            return this.db.getEmailDomainBlacklistEntry(domainName);
        },

        updateDomainBlacklistEntry(blacklistEntry) {
            const { domainName, ...entry } = blacklistEntry;
            return this.db.updateEmailDomainBlacklistEntry(domainName, entry);
        },
    },
});

module.exports = EmailDomainBlacklistService;
