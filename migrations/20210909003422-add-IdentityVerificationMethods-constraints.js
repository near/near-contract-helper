'use strict';

const TABLE_NAME = 'IdentityVerificationMethods';
const kindConstraintName = 'kind_constraint_identity_verification_method';
const uniqueIdentityConstraintName = 'unique_constraint_identity_verification_method';

module.exports = {
    up: async (queryInterface) => queryInterface
        .sequelize
        .transaction(async (transaction) => {
            return Promise.all([
                queryInterface.addConstraint(
                    TABLE_NAME,
                    {
                        fields: ['kind'],
                        name: kindConstraintName,
                        type: 'check',
                        where: {
                            kind: ['email', 'phone']
                        }
                    },
                    { transaction }
                ),

                queryInterface.addConstraint(
                    TABLE_NAME,
                    {
                        fields: ['identityKey'],
                        name: uniqueIdentityConstraintName,
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
                    kindConstraintName,
                    { transaction }
                ),
                queryInterface.removeConstraint(
                    TABLE_NAME,
                    uniqueIdentityConstraintName,
                    { transaction }
                ),
            ]);
        })
};
