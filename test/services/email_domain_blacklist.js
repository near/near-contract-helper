const EmailDomainBlacklistService = require('../../services/email_domain_blacklist');
const chai = require('../chai');
const { deleteAllRows } = require('../db');

const { expect } = chai;

const DOMAIN_NAME = 'near.org';
const STALE_AT = (new Date()).toString();

describe('EmailDomainBlacklistService', function () {
    describe('getDomainBlacklistEntry', function () {
        before(async function() {
            await deleteAllRows();
        });

        it('gets the specified blacklist entry by domain', async function () {
            await EmailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
            });

            const blacklistEntry = await EmailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });

        it('returns null for nonexistent domains', async function () {
            const blacklistEntry = await EmailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });
    });

    describe('updateDomainBlacklistEntry', function () {
        before(async function() {
            await deleteAllRows();
        });

        it('creates the blacklist entry when one does not already exist', async function () {
            await EmailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
            });
            const blacklistEntry = await EmailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });

        it('updates the existing blacklist entry', async function () {
            let blacklistEntry = await EmailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('isTemporaryEmailService', null);

            await EmailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
                isTemporaryEmailService: true,
            });

            blacklistEntry = await EmailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('isTemporaryEmailService', true);
        });
    });
});
