'use strict';

const messageContentHelpers = require('../../middleware/2fa_service/messageContent');
const { getSecurityCodeEmail, getNewAccountEmail, get2faHtml } = require('../../utils/email');
const messageContentFixtures = require('./fixtures');
const validateAcceptanceTestContent = require('./validateAcceptanceTest');

const {
    getAddingFullAccessKeyMessageContent,
    getConfirmTransactionMessageContent
} = messageContentHelpers;

const {
    actionsByType,
    allActions
} = messageContentFixtures;


describe('email content', function () {
    describe('acceptance tests', function () {
        it('security code email should match our sample html', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateOfExistingSample = false;
            const samplePathSegments = ['html', 'securityCode.html'];

            const messageContent = getSecurityCodeEmail('exampleaccount3456', '123456');

            validateAcceptanceTestContent({
                forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                samplePathSegments,
                newMessageContent: messageContent
            });
        });

        it('new account email should match our sample html', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateOfExistingSample = false;
            const samplePathSegments = ['html', 'newAccount.html'];

            const messageContent = getNewAccountEmail('exampleaccount3456', 'http://example.recovery.url.com', '123456');

            validateAcceptanceTestContent({
                forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                samplePathSegments,
                newMessageContent: messageContent
            });
        });

        describe('2fa emails', function () {
            it('adding new FULL ACCESS KEY should match our sample html', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateOfExistingSample = false;
                const samplePathSegments = ['html', '2faAddingFullAccessKey.html'];

                const { requestDetails } = getAddingFullAccessKeyMessageContent({
                    accountId: 'exampleaccount3456',
                    recipient: '+1 555-555-5555',
                    securityCode: '123456',
                    publicKey: actionsByType.AddKey.addFullAccessKey.public_key,
                    request: {
                        receiver_id: 'exampleaccount3456',
                        actions: [actionsByType.AddKey.addFullAccessKey]
                    },
                    isForSms: false
                });

                const htmlContent = get2faHtml('123456', requestDetails, {
                    accountId: 'exampleaccount3456',
                    public_key: 'fakKey'
                });

                validateAcceptanceTestContent({
                    forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                    samplePathSegments,
                    newMessageContent: htmlContent
                });
            });

            it('confirm transactions with 2fa should match our sample message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateOfExistingSample = false;
                const samplePathSegments = ['html', 'confirm2faTransactions.html'];

                const { requestDetails } = getConfirmTransactionMessageContent({
                    accountId: 'exampleaccount3456',
                    recipient: '+1 555-555-5555',
                    securityCode: '123456',
                    request: {
                        receiver_id: 'testreceiveraccount',
                        actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                    },
                    isForSms: false
                });


                const htmlContent = get2faHtml('123456', requestDetails);

                validateAcceptanceTestContent({
                    forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                    samplePathSegments,
                    newMessageContent: htmlContent
                });
            });
        });
    });
});