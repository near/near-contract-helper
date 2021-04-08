'use strict';
const path = require('path');

const messageContentHelpers = require('../../middleware/2faMessageContent');
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

function inTestOutputDir(...destPath) {
    return path.join(__dirname, 'acceptanceTestOutputs', ...destPath);
}

describe('message HTML content acceptance tests', function () {
    it('security code html should match our sample html', function () {
        // Acceptance test: run with this set to `true` to regenerate sample.
        const forceUpdateOfExistingSample = false;
        const messageContent = getSecurityCodeEmail('exampleaccount3456', '123456');

        validateAcceptanceTestContent({
            forceUpdateOfExistingSample: forceUpdateOfExistingSample,
            filePathRelative: inTestOutputDir('securityCode.html'),
            newMessageContent: messageContent
        });
    });

    it('new account html should match our sample html', function () {
        // Acceptance test: run with this set to `true` to regenerate sample.
        const forceUpdateOfExistingSample = false;
        const messageContent = getNewAccountEmail('exampleaccount3456', 'http://example.recovery.url.com', '123456');

        validateAcceptanceTestContent({
            forceUpdateOfExistingSample: forceUpdateOfExistingSample,
            filePathRelative: inTestOutputDir('newAccount.html'),
            newMessageContent: messageContent
        });
    });

    describe('2fa html', function () {
        it('adding new FULL ACCESS KEY should match our sample html', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateOfExistingSample = false;

            const { requestDetails } = getAddingFullAccessKeyMessageContent({
                accountId: 'exampleaccount3456',
                recipient: '+1 555-555-5555',
                securityCode: '123456',
                publicKey: actionsByType.AddKey.addFullAccessKey.public_key,
                request: {
                    receiver_id: 'exampleaccount3456',
                    actions: [actionsByType.AddKey.addFullAccessKey]
                }
            });

            const htmlContent = get2faHtml('123456', requestDetails, {
                accountId: 'exampleaccount3456',
                public_key: 'fakKey'
            });

            validateAcceptanceTestContent({
                forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                filePathRelative: inTestOutputDir('2faAddingFullAccessKey.html'),
                newMessageContent: htmlContent
            });
        });

        it('confirm transactions with 2fa should match our sample message', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateOfExistingSample = false;
            const { requestDetails } = getConfirmTransactionMessageContent({
                accountId: 'exampleaccount3456',
                recipient: '+1 555-555-5555',
                securityCode: '123456',
                request: {
                    receiver_id: 'testreceiveraccount',
                    actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                }
            });


            const htmlContent = get2faHtml('123456', requestDetails);

            validateAcceptanceTestContent({
                forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                filePathRelative: inTestOutputDir('confirm2faTransactions.html'),
                newMessageContent: htmlContent
            });
        });
    });
});