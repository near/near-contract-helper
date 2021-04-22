'use strict';

const base64Stringify = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');

const shortJSONArgs = {
    someArg: 'shortArg',
    deposit: '100000000000000000000000000000',
    amount: '1000000000000000000000000000'
}; // 93 characters long

const longJSONArgs = {
    someArg: 'longestArgsAreTheBestArgs',
    someArg2: 'longestArgsAreTheBestArgs',
    someArg3: 'longestArgsAreTheBestArgs',
    someArg4: 'longestArgsAreTheBestArgs',
    someArg5: 'longestArgsAreTheBestArgs',
    someArg6: 'longestArgsAreTheBestArgs',
    deposit: '103000000000000000000000000000',
    amount: '110000000000000000000000000000'
}; // 319 characters long

const actionsByType = {
    FunctionCall: {
        doAThingWithShortJSONArgs: {
            type: 'FunctionCall',
            method_name: 'DoAThingWithShortJSONArgs',
            args: base64Stringify(shortJSONArgs),
            deposit: '100000000000000000000000000000',
            amount: '150000000000000000000000000000',
        },

        doAThingWithLongJSONArgs: {
            type: 'FunctionCall',
            method_name: 'DoAThingWithLongJSONArgs',
            args: base64Stringify(longJSONArgs),
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

module.exports = {
    shortJSONArgs,
    longJSONArgs,
    actionsByType,
    allActions
};