'use strict';
const path = require('path');
const sinon = require('sinon');

const recoveryMessageContentHelpers = require('../../accountRecoveryMessageContent');
const messageContent2faHelpers = require('../../middleware/2faMessageContent');
const { get2faHtml } = require('../../utils/email');
const messageContentFixtures = require('./fixtures');
const validateAcceptanceTestContent = require('./validateAcceptanceTest');

const {
    getVerify2faMethodMessageContent,
    getAddingFullAccessKeyMessageContent,
    getConfirmTransactionMessageContent
} = messageContent2faHelpers;

const { getNewAccountMessageContent, getSecurityCodeMessageContent } = recoveryMessageContentHelpers;

const {
    actionsByType,
    allActions
} = messageContentFixtures;

function inTestOutputDir(testname, filename) {
    return {
        directory: path.join(__dirname, 'acceptanceTestOutputs', testname),
        filename
    };
}

function getMessageContentAcceptanceOutput(messageContent) {
    return `Text content for SMS and rich text incapable email clients:
-----------------------------------
${messageContent.text}
-----------------------------------

Subject (included in email only):
-----------------------------------                
${messageContent.subject}
-----------------------------------

Request Details (included in email only):
-----------------------------------
${(messageContent.requestDetails || []).join('\n')}
-----------------------------------
`;
}

describe('message content acceptance tests', function () {
    let clock;

    before(() => {
        clock = sinon.useFakeTimers(
            (new Date()).setYear(2020)
        );
    });

    after(() => {
        clock.restore();
    });

    describe('get security code', function () {
        let messageContent;

        before(function() {
            messageContent = getSecurityCodeMessageContent({
                accountId: 'exampleaccount3456',
                securityCode: '123456'
            });
        });

        it('security code html should match our acceptance html', function () {
            // Acceptance test: run with this set to `true` to regenerate acceptance.
            const forceUpdateAcceptanceTestContent = false;

            const { html } = messageContent;

            validateAcceptanceTestContent({
                forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                output: inTestOutputDir('getSecurityCode', 'getSecurityCode.html'),
                newMessageContent: html
            });
        });

        it('security code message content should match our acceptance message', function () {
            // Acceptance test: run with this set to `true` to regenerate acceptance.
            const forceUpdateAcceptanceTestContent = false;

            const { text, subject } = messageContent;

            validateAcceptanceTestContent({
                forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                output: inTestOutputDir('getSecurityCode', 'getSecurityCode.txt'),
                newMessageContent: getMessageContentAcceptanceOutput({ text, subject })
            });
        });
    });

    describe('create new account', function () {
        let messageContent;

        before(function () {
            messageContent = getNewAccountMessageContent({
                accountId: 'exampleaccount3456',
                securityCode: '123456',
                recoverUrl: 'http://www.example.recover.url/'
            });
        });

        it('new account html should match our acceptance html', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateAcceptanceTestContent = false;

            const { html } = messageContent;

            validateAcceptanceTestContent({
                forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                output: inTestOutputDir('createNewAccount', 'createNewAccount.html'),
                newMessageContent: html
            });
        });

        it('new account message content should match our acceptance message', function () {
            // Acceptance test: run with this set to `true` to regenerate sample.
            const forceUpdateAcceptanceTestContent = false;

            const { subject, text } = messageContent;

            validateAcceptanceTestContent({
                forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                output: inTestOutputDir('createNewAccount', 'createNewAccount.txt'),
                newMessageContent: getMessageContentAcceptanceOutput({ subject, text })
            });
        });
    });

    describe('2fa message contents', function () {
        describe('adding new FULL ACCESS KEY', function () {
            let messageContent;

            before(function () {
                messageContent = getAddingFullAccessKeyMessageContent({
                    accountId: 'exampleaccount3456',
                    securityCode: '123456',
                    publicKey: actionsByType.AddKey.addFullAccessKey.public_key,
                    request: {
                        receiver_id: 'exampleaccount3456',
                        actions: [actionsByType.AddKey.addFullAccessKey]
                    }
                });
            });

            it('adding new FULL ACCESS KEY should match our acceptance html', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;

                const { requestDetails } = messageContent;
                const htmlContent = get2faHtml('123456', requestDetails, {
                    accountId: 'exampleaccount3456',
                    public_key: 'fakKey'
                });

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('addFullAccessKey2fa', '2faAddingFullAccessKey.html'),
                    newMessageContent: htmlContent
                });
            });

            it('adding new FULL ACCESS KEY should match our acceptance message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;


                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('addFullAccessKey2fa', '2faAddingFullAccessKey.txt'),
                    newMessageContent: getMessageContentAcceptanceOutput(messageContent)
                });
            });
        });

        describe('confirm transactions with 2fa', function () {
            let messageContent;

            before(function () {
                messageContent = getConfirmTransactionMessageContent({
                    accountId: 'exampleaccount3456',
                    securityCode: '123456',
                    request: {
                        receiver_id: 'testreceiveraccount',
                        actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                    }
                });
            });

            it('confirm transactions with 2fa should match our acceptance html', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;
                const { requestDetails } = messageContent;


                const htmlContent = get2faHtml('123456', requestDetails);

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('confirmTransactions2fa', 'confirmTransactions2fa.html'),
                    newMessageContent: htmlContent
                });
            });

            it('confirm transactions with 2fa should match our acceptance message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;
                const messageContent = getConfirmTransactionMessageContent({
                    accountId: 'exampleaccount3456',
                    securityCode: '123456',
                    request: {
                        receiver_id: 'testreceiveraccount',
                        actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                    },
                });

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('confirmTransactions2fa', 'confirmTransactions2fa.txt'),
                    newMessageContent: getMessageContentAcceptanceOutput(messageContent)
                });
            });
        });

        describe('verify add new 2FA Method', function () {
            let messageContent;

            before(function () {
                messageContent = getVerify2faMethodMessageContent({
                    accountId: 'exampleaccount3456',
                    securityCode: '123456',
                    destination: '+1 555-555-5555',
                });
            });

            it('verify add new 2FA Method should match our acceptance html', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;

                const { requestDetails } = messageContent;
                const htmlContent = get2faHtml('123456', requestDetails);

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('verify2faMethod', 'verify2faMethod.html'),
                    newMessageContent: htmlContent
                });
            });

            it('verify add new 2FA Method should match our sample message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('verify2faMethod', 'verify2faMethod.txt'),
                    newMessageContent: getMessageContentAcceptanceOutput(messageContent)
                });
            });
        });

        describe('confirm transactions with 2fa - SMS delivery should not HTML escape', function () {

            it('confirm transactions with 2fa should match our acceptance message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateAcceptanceTestContent = false;

                const messageContent = getConfirmTransactionMessageContent({
                    accountId: 'exampleaccount3456',
                    securityCode: '123456',
                    request: {
                        receiver_id: 'testreceiveraccount',
                        actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                    },
                    isForSmsDelivery: true
                });

                validateAcceptanceTestContent({
                    forceUpdateAcceptanceTestContent: forceUpdateAcceptanceTestContent,
                    output: inTestOutputDir('confirmTransactions2fa', 'confirmTransactions2fa-sms.txt'),
                    newMessageContent: getMessageContentAcceptanceOutput(messageContent)
                });
            });
        });
    });
});
