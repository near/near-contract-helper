const { updateDocument } = require('../../dynamo');
const EmailDomainBlacklist = require('../../schemas/email_domain_blacklist');

function updateAccount(domainName, blacklistEntry) {
    return updateDocument(EmailDomainBlacklist, {
        domainName,
        ...blacklistEntry,
    });
}

module.exports = updateAccount;
