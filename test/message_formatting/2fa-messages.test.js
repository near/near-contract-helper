'use strict';

const path = require('path');
const fs = require('fs');

const messageContentHelpers = require('../../middleware/2fa_service/messageContent');
const chai = require('../chai');
const messageContentFixtures = require('./fixtures');
const toBase64 = require('../toBase64');

const { expect } = chai;

const {
    formatArgs,
    formatAction,
    getVerify2faMethodMessageContent,
    getConfirmTransactionMessageContent,
    getAddingFullAccessKeyMessageContent
} = messageContentHelpers;

const {
    longJSONArgs,
    shortJSONArgs,
    actionsByType
} = messageContentFixtures;

const allActions = Object.values(actionsByType)
    .reduce(
        (actionsFlat, byType) => {
            Object.values(byType).forEach((action) => {
                actionsFlat.push(action);
            });
            return actionsFlat;
        },
        []
    );


function getSMSMessageAcceptanceTestOutput(messageContent) {
    return `Text content for SMS and rich text incapable email clients:
-----------------------------------
${messageContent.text}
-----------------------------------

Subject (email only):
-----------------------------------                
${messageContent.subject}
-----------------------------------

Request Details (email only):
-----------------------------------
${messageContent.requestDetails.join('\n')}
-----------------------------------
`;
}

function validateAcceptanceTestContent({ forceUpdateOfExistingSample, sampleFilename, newMessageContent }) {
    if (forceUpdateOfExistingSample) {
        console.warn('Updating sample message content for "Verify 2FA Method"');
        fs.writeFileSync(
            path.resolve(__dirname, 'samples', sampleFilename),
            newMessageContent,
            { encoding: 'UTF-8' }
        );
    } else {
        let existingMessageContent;
        try {
            existingMessageContent = fs.readFileSync(
                path.resolve(__dirname, 'samples', sampleFilename),
                { encoding: 'UTF-8' }
            );
        } catch (e) {
            console.log(`initializing new sample file: ${sampleFilename}`);
            fs.writeFileSync(
                path.resolve(__dirname, 'samples', sampleFilename),
                newMessageContent,
                { encoding: 'UTF-8' }
            );
            existingMessageContent = newMessageContent;
        }

        expect(newMessageContent).equal(
            existingMessageContent,
            'If you have intentionally changed the message content and your changes look good, ' +
            'set "forceUpdateOfExistingSample" to true and re-run this test to update the sample file: ' + sampleFilename
        );
    }
}

describe('message content', function messageContent() {
    describe('formatArgs()', () => {
        describe('JSON arguments', function jsonArguments() {
            it('should truncate long JSON args appropriately when formatting for SMS', function () {
                expect(formatArgs(toBase64(longJSONArgs), true)).length(250);
            });

            it('should include the entire content of long `args` when formatting for email', function () {
                expect(formatArgs(toBase64(longJSONArgs), false)).length(275);
            });

            it('should always include the entire content of short args', function () {
                expect(formatArgs(toBase64(shortJSONArgs), true)).length(61);
                expect(formatArgs(toBase64(shortJSONArgs), false)).length(61);
            });

            it('should compose output so that `amount` and `deposit` are always first', function () {
                const formattedArgsWithAmount = formatArgs(
                    toBase64(JSON.stringify({
                        alfalfa: 1,
                        amount: 2
                    }))
                );

                expect(Object.keys(JSON.parse(formattedArgsWithAmount)))
                    .deep
                    .equal(['amount', 'alfalfa']);

                const formattedArgsWithAmountAndDeposit = formatArgs(toBase64(JSON.stringify({
                    winning: 1,
                    deposit: 3,
                    amount: 2,
                })));

                expect(Object.keys(JSON.parse(formattedArgsWithAmountAndDeposit)))
                    .deep
                    .equal(['amount', 'deposit', 'winning']);
            });
        });

        describe('non-JSON arguments', function () {
            it('should include the entire content of args when it is short enough to deliver to SMS', function () {
                const inputStr = 'ping maximushaximus';

                expect(formatArgs(toBase64(inputStr), true)).length(110);
            });

            it('should truncate the entire content of args when it is too long post-hex encoding to deliver to SMS', function () {
                const inputStr = 'ping maximushaximus if you love NEAR! Because he does, and you should too! :)';

                expect(formatArgs(toBase64(inputStr), false)).length.above(250);
                expect(formatArgs(toBase64(inputStr), true)).length(250);
            });
        });
    });

    describe('formatAction()', function () {
        const args = toBase64(JSON.stringify({ htmlContent: '<a href="somewhere"></a>' }));

        it('should not escape possible HTML sequences when sending to SMS', function () {
            const actionFormatted = formatAction(
                { receiver_id: 'receiver-account', isForSms: true },
                {
                    type: 'FunctionCall',
                    method_name: 'do_something',
                    args,
                    deposit: 1000000,
                    amount: 100000,
                    public_key: 'fake_public_key',
                });

            expect(actionFormatted).not.includes('&');
        });

        it('should escape possible HTML sequences when sending to email', function () {
            const actionFormatted = formatAction(
                { receiver_id: 'receiver-account', isForSms: false },
                {
                    type: 'FunctionCall',
                    method_name: 'doSomething',
                    args,
                    deposit: 1000000,
                    amount: 100000,
                    public_key: 'fake_public_key',
                }
            );

            expect(actionFormatted).includes('\\&quot;somewhere\\&quot;');
        });
    });

    describe('generate message samples', function () {
        describe('verify 2FA Method', function () {
            it('should match our sample message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateOfExistingSample = false;
                const sampleFilename = 'verify2faMethodText';

                const messageContent = getVerify2faMethodMessageContent({
                    accountId: 'exampleaccount3456',
                    recipient: '+1 555-555-5555',
                    securityCode: '123456'
                });

                validateAcceptanceTestContent({
                    forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                    sampleFilename: sampleFilename,
                    newMessageContent: getSMSMessageAcceptanceTestOutput(messageContent)
                });
            });
        });

        describe('confirm transactions with 2fa', function () {
            it('should match our sample message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateOfExistingSample = false;
                const sampleFilename = 'confirm2faTransactionText';

                const messageContent = getConfirmTransactionMessageContent({
                    accountId: 'exampleaccount3456',
                    recipient: '+1 555-555-5555',
                    securityCode: '123456',
                    request: {
                        receiver_id: 'testreceiveraccount',
                        actions: allActions.filter(({ type, permission }) => !(type === 'AddKey' && !permission))
                    },
                    isForSms: true
                });

                validateAcceptanceTestContent({
                    forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                    sampleFilename: sampleFilename,
                    newMessageContent: getSMSMessageAcceptanceTestOutput(messageContent)
                });
            });
        });

        describe('adding a full access key with 2fa', function () {
            it('should match our sample message', function () {
                // Acceptance test: run with this set to `true` to regenerate sample.
                const forceUpdateOfExistingSample = false;
                const sampleFilename = 'addingFullAccessKeyText';

                const messageContent = getAddingFullAccessKeyMessageContent({
                    accountId: 'exampleaccount3456',
                    recipient: '+1 555-555-5555',
                    securityCode: '123456',
                    publicKey: actionsByType.AddKey.addFullAccessKey.public_key,
                    request: {
                        receiver_id: 'exampleaccount3456',
                        actions: [actionsByType.AddKey.addFullAccessKey]
                    },
                    isForSms: true
                });

                validateAcceptanceTestContent({
                    forceUpdateOfExistingSample: forceUpdateOfExistingSample,
                    sampleFilename: sampleFilename,
                    newMessageContent: getSMSMessageAcceptanceTestOutput(messageContent)
                });
            });
        });
    });
});