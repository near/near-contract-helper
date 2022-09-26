require('dotenv').config({ path: 'test/.env.test' });

const { initTestDynamo } = require('../../local_dynamo');
const EmailDomainBlacklistService = require('../../src/services/email_domain_blacklist');
const chai = require('../chai');

const { expect } = chai;

const DOMAIN_NAME = 'near.org';
const STALE_AT = (new Date()).toString();

const emailDomainBlacklistService = new EmailDomainBlacklistService();

describe('EmailDomainBlacklistService', function () {
    let terminateLocalDynamo = () => {};
    before(async function() {
        this.timeout(20000);
        ({ terminateLocalDynamo } = await initTestDynamo());
    });

    after(function() {
        terminateLocalDynamo();
    });

    describe('getDomainBlacklistEntry', function () {
        it('gets the specified blacklist entry by domain', async function () {
            await emailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
            });

            const blacklistEntry = await emailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });

        it('returns null for nonexistent domains', async function () {
            const blacklistEntry = await emailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });
    });

    describe('updateDomainBlacklistEntry', function () {
        it('creates the blacklist entry when one does not already exist', async function () {
            await emailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
            });
            const blacklistEntry = await emailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('domainName', DOMAIN_NAME);
        });

        it('updates the existing blacklist entry', async function () {
            let blacklistEntry = await emailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).not.have.property('isTemporaryEmailService');

            await emailDomainBlacklistService.updateDomainBlacklistEntry({
                domainName: DOMAIN_NAME,
                staleAt: STALE_AT,
                isTemporaryEmailService: true,
            });

            blacklistEntry = await emailDomainBlacklistService.getDomainBlacklistEntry(DOMAIN_NAME);
            expect(blacklistEntry).property('isTemporaryEmailService', true);
        });
    });
});
