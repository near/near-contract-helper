require('dotenv').config({ path: 'test/.env.test' });

const EmailDomainBlacklistService = require('../../services/email_domain_blacklist');
const chai = require('../chai');
const { deleteAllRows } = require('../db');
const { USE_DYNAMODB } = require('../../features');
const initLocalDynamo = require('../local_dynamo');

const { expect } = chai;

const DOMAIN_NAME = 'near.org';
const STALE_AT = (new Date()).toString();

const emailDomainBlacklistService = new EmailDomainBlacklistService();

describe('EmailDomainBlacklistService', function () {
    let terminateLocalDynamo;
    before(async function() {
        if (USE_DYNAMODB) {
            this.timeout(10000);
            ({ terminateLocalDynamo } = await initLocalDynamo());
        }
    });

    after(async function() {
        if (USE_DYNAMODB) {
            await terminateLocalDynamo();
        }
    });

    describe('getDomainBlacklistEntry', function () {
        before(async function() {
            if (!USE_DYNAMODB) {
                await deleteAllRows();
            }
        });

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
        before(async function() {
            if (!USE_DYNAMODB) {
                await deleteAllRows();
            }
        });

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
            if (USE_DYNAMODB) {
                expect(blacklistEntry).not.have.property('isTemporaryEmailService');
            } else {
                expect(blacklistEntry).property('isTemporaryEmailService', null);
            }

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
