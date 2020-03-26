'use strict';

module.exports = {
    up: queryInterface => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.addConstraint(
                    'RecoveryMethods',
                    ['kind'],
                    {
                        name: 'kind_constraint',
                        type: 'check',
                        where: {
                            kind: ['email', 'phone', 'phrase']
                        }
                    },
                    { transaction }
                ),

                // this doesn't prevent having two duplicate records both with NULL publicKey
                queryInterface.addConstraint(
                    'RecoveryMethods',
                    ['AccountId', 'kind', 'publicKey'],
                    {
                        name: 'unique_constraint',
                        type: 'unique',
                    },
                    { transaction }
                )
            ]);
        });
    },

    down: queryInterface => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.removeConstraint(
                    'RecoveryMethods',
                    'kind_constraint',
                    { transaction }
                ),
                queryInterface.removeConstraint(
                    'RecoveryMethods',
                    'unique_constraint',
                    { transaction }
                ),
            ]);
        });
    }
};
