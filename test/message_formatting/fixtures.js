'use strict';

const shortJSONArgs = JSON.stringify({
    someArg: 'shortArg',
    deposit: '10000000000000000000000',
    amount: '10000000000000000000000'
}); // 93 characters long

const longJSONArgs = JSON.stringify({
    someArg: 'longestArgsAreTheBestArgs',
    someArg2: 'longestArgsAreTheBestArgs',
    someArg3: 'longestArgsAreTheBestArgs',
    someArg4: 'longestArgsAreTheBestArgs',
    someArg5: 'longestArgsAreTheBestArgs',
    someArg6: 'longestArgsAreTheBestArgs',
    deposit: '100000000000000000000000000000',
    amount: '100000000000000000000000000000'
}); // 319 characters long

module.exports = {
    shortJSONArgs,
    longJSONArgs,
};