'use strict';

const messageContentHelpers = require('../../middleware/2fa_service/messageContent');
const chai = require('../chai');
const messageContentFixtures = require('./fixtures');
const toBase64 = require('../toBase64');

const { expect } = chai;
const { formatArgs } = messageContentHelpers;
const {
    longJSONArgs,
    shortJSONArgs,
} = messageContentFixtures;

describe('message content', function () {
    describe('formatArgs()', () => {
        describe('JSON arguments', function () {
            it('should truncate long JSON args appropriately when formatting for SMS', function () {
                expect(formatArgs(toBase64(longJSONArgs), true)).length(250);
            });

            it('should include the entire content of long `args` when formatting for email', function () {
                expect(formatArgs(toBase64(longJSONArgs), false)).length(275);
            });

            it('should always include the entire content of short args', function () {
                expect(formatArgs(toBase64(shortJSONArgs), true)).length(57);
                expect(formatArgs(toBase64(shortJSONArgs), false)).length(57);
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

    });
});