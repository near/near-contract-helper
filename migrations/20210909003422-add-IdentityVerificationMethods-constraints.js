'use strict';

const TABLE_NAME = 'IdentityVerificationMethods';

module.exports = {
    up: async (queryInterface) => queryInterface
        .sequelize
        .transaction(async (transaction) => {
            return Promise.all([
                queryInterface.addConstraint(
                    TABLE_NAME,
                    {
                        fields: ['kind'],
                        name: 'kind_constraint',
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
                        name: 'unique_constraint',
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
                    'kind_constraint',
                    { transaction }
                ),
                queryInterface.removeConstraint(
                    TABLE_NAME,
                    'unique_constraint',
                    { transaction }
                ),
            ]);
        })
};
