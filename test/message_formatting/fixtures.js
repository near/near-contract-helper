'use strict';

const toBase64 = require('../toBase64');

const shortJSONArgs = JSON.stringify({
    someArg: 'shortArg',
    deposit: '100000000000000000000000000000',
    amount: '1000000000000000000000000000'
}); // 93 characters long

const longJSONArgs = JSON.stringify({
    someArg: 'longestArgsAreTheBestArgs',
    someArg2: 'longestArgsAreTheBestArgs',
    someArg3: 'longestArgsAreTheBestArgs',
    someArg4: 'longestArgsAreTheBestArgs',
    someArg5: 'longestArgsAreTheBestArgs',
    someArg6: 'longestArgsAreTheBestArgs',
    deposit: '103000000000000000000000000000',
    amount: '110000000000000000000000000000'
}); // 319 characters long

const actionsByType = {
    FunctionCall: {
        doAThingWithShortJSONArgs: {
            type: 'FunctionCall',
            method_name: 'DoAThingWithShortJSONArgs',
            args: toBase64(shortJSONArgs),
            deposit: '100000000000000000000000000000',
            amount: '150000000000000000000000000000',
        },

        doAThingWithLongJSONArgs: {
            type: 'FunctionCall',
            method_name: 'DoAThingWithLongJSONArgs',
            args: toBase64(longJSONArgs),
            deposit: '18000000000000000000000000000000',
            amount: '1005000000000000000000000000',
        }
    },
    Transfer: {
        transfer: {
            type: 'Transfer',
            amount: '10500000000000000000000000',
        }
    },
    Stake: {
        stake: {
            type: 'Stake',
            amount: '1500000000000000000000000',
        }
    },
    DeleteKey: {
        deleteAKey: {
            type: 'DeleteKey',
            public_key: 'fakePublicKeyIsTheBestPublicKey',
        }
    },
    AddKey: {
        addFullAccessKey: {
            type: 'AddKey',
            public_key: 'fakePublicKeyIsTheBestPublicKey',
        },
        addRestrictedAccessKeyForSpecificMethods: {
            type: 'AddKey',
            public_key: 'fakePublicKeyIsTheBestPublicKey',
            permission: {
                allowance: '10000',
                receiver_id: 'an-account-id',
                method_names: ['doSomething', 'doAnotherThing']
            }
        },
        addRestrictedAccessKeyForAllMethods: {
            type: 'AddKey',
            public_key: 'fakePublicKeyIsTheBestPublicKey',
            permission: {
                allowance: '10000',
                receiver_id: 'an-account-id',
            }
        }
    }
};

module.exports = {
    shortJSONArgs,
    longJSONArgs,
    actionsByType
};