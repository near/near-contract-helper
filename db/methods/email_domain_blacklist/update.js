const { updateDocument } = require('../../dynamo');
const EmailDomainBlacklist = require('../../schemas/email_domain_blacklist');

function updateEmailDomainBlacklistEntry(domainName, { error, hasValidDNSMXRecord, isTemporaryEmailService, staleAt }) {
    return updateDocument(EmailDomainBlacklist, {
        domainName,
        error,
        hasValidDNSMXRecord,
        isTemporaryEmailService,
        staleAt,
    });
}

module.exports = updateEmailDomainBlacklistEntry;
