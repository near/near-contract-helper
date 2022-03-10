const { getDocument } = require('../../dynamo');
const EmailDomainBlacklist = require('../../schemas/email_domain_blacklist');

function getEmailDomainBlacklistEntry(domainName) {
    return getDocument(EmailDomainBlacklist, { domainName });
}

module.exports = getEmailDomainBlacklistEntry;
