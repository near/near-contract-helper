'use strict';

const TABLE_NAME = 'IdentityVerificationMethods';
const uniqueIdentityKeyConstraintName = 'unique_constraint_identityKey_verification_method';

module.exports = {
    up: async (queryInterface) => queryInterface
        .sequelize
        .transaction(async (transaction) => {
            return Promise.all([
                queryInterface.addConstraint(
                    TABLE_NAME,
                    {
                        fields: ['uniqueIdentityKey'],
                        name: uniqueIdentityKeyConstraintName,
                        type: 'unique',
                    },
                    { transaction }
                )
            ]);
        }),

    down: async (queryInterface) => queryInterface
        .sequelize
        .transaction(async (transaction) => {
            return Promise.all([
                queryInterface.removeConstraint(
                    TABLE_NAME,
                    uniqueIdentityKeyConstraintName,
                    { transaction }
                ),
            ]);
        })
};
