const stampit = require('@stamp/it');

const {
    getEmailDomainBlacklistEntry,
    updateEmailDomainBlacklistEntry,
} = require('../db/methods/email_domain_blacklist');
const { USE_DYNAMODB } = require('../features');
const SequelizeEmailDomainBlacklists = require('./sequelize/email_domain_blacklist');


const EmailDomainBlacklistService = stampit({
    methods: {
        getDomainBlacklistEntry(domainName) {
            if (!USE_DYNAMODB) {
                return SequelizeEmailDomainBlacklists.getDomainBlacklistEntry(domainName);
            }
            return getEmailDomainBlacklistEntry(domainName);
        },

        updateDomainBlacklistEntry(blacklistEntry) {
            if (!USE_DYNAMODB) {
                return SequelizeEmailDomainBlacklists.updateDomainBlacklistEntry(blacklistEntry);
            }
            const { domainName, ...entry } = blacklistEntry;
            return updateEmailDomainBlacklistEntry(domainName, entry);
        },
    },
});

module.exports = EmailDomainBlacklistService;
