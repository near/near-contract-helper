'use strict';

const twoFactorMessageContentHelpers = require('../../middleware/2faMessageContent');
const chai = require('../chai');
const messageContentFixtures = require('./fixtures');

const { expect } = chai;

const {
    formatArgs,
    formatAction,
} = twoFactorMessageContentHelpers;

const {
    longJSONArgs,
    shortJSONArgs,
} = messageContentFixtures;

const toBase64 = (str) => Buffer.from(str).toString('base64');
const base64Stringify = (obj) => toBase64(JSON.stringify(obj));

describe('message content', function messageContent() {
    describe('formatArgs()', () => {
        describe('JSON arguments', function jsonArguments() {
            it('should truncate long JSON args appropriately when formatting for SMS', function () {
                expect(formatArgs(base64Stringify(longJSONArgs), true)).length(250);
            });

            it('should include the entire content of long `args` when formatting for email', function () {
                expect(formatArgs(base64Stringify(longJSONArgs), false)).length(275);
            });

            it('should always include the entire content of short args', function () {
                expect(formatArgs(base64Stringify(shortJSONArgs), true)).length(61);
                expect(formatArgs(base64Stringify(shortJSONArgs), false)).length(61);
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
                'receiver-account',
                {
                    type: 'FunctionCall',
                    method_name: 'do_something',
                    args,
                    deposit: 1000000,
                    amount: 100000,
                    public_key: 'fake_public_key',
                },
                true
            );

            expect(actionFormatted).not.includes('&');
        });

        it('should escape possible HTML sequences when sending to email', function () {
            const actionFormatted = formatAction(
                'receiver-account',
                {
                    type: 'FunctionCall',
                    method_name: 'doSomething',
                    args,
                    deposit: 1000000,
                    amount: 100000,
                    public_key: 'fake_public_key',
                },
                false
            );

            expect(actionFormatted).includes('\\&quot;somewhere\\&quot;');
        });
    });
});