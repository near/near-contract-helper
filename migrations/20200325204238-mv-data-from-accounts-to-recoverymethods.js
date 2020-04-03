'use strict';

module.exports = {
    up: queryInterface => {
        return queryInterface.sequelize.transaction(transaction => {
            return new Promise(resolve => {
                Promise.all([
                    queryInterface.sequelize.query(
                        'SELECT * FROM "Accounts" WHERE "phoneNumber" IS NOT NULL',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'SELECT * FROM "Accounts" WHERE "email" IS NOT NULL',
                        { transaction }
                    )
                ]).then(([[phoneRecords], [emailRecords]]) => {
                    Promise.all([
                        phoneRecords.length && queryInterface.bulkInsert(
                            'RecoveryMethods',
                            phoneRecords.map(account => ({
                                AccountId: account.id,
                                kind: 'phone',
                                detail: account.phoneNumber,
                                createdAt: account.updatedAt,
                                updatedAt:account.updatedAt,
                            })),
                            { transaction }
                        ),
                        emailRecords.length && queryInterface.bulkInsert(
                            'RecoveryMethods',
                            emailRecords.map(account => ({
                                AccountId: account.id,
                                kind: 'email',
                                detail: account.email,
                                createdAt: account.updatedAt,
                                updatedAt:account.updatedAt,
                            })),
                            { transaction }
                        )
                    ]).then(resolve).catch(err => {
                        console.error(err);
                        return transaction.rollback();
                    });
                }).catch(err => {
                    console.error(err);
                    return transaction.rollback();
                });
            });
        });
    },

    down: queryInterface => {
        return queryInterface.sequelize.transaction(transaction => {
            return new Promise(resolve => {
                return queryInterface.sequelize.query(
                    'SELECT * FROM "RecoveryMethods"',
                    { transaction }
                ).then(([results]) => {
                    Promise.all(results.map(recoveryMethod => {
                        if (recoveryMethod.kind === 'phrase') return true;

                        const column = recoveryMethod.kind === 'phone'
                            ? 'phoneNumber'
                            : 'email';

                        return queryInterface.sequelize.query(
                            `UPDATE "Accounts"
                             SET "${column}" = '${recoveryMethod.detail}'
                             WHERE "id" = ${recoveryMethod.AccountId}`,
                            { transaction }
                        );
                    })).then(resolve).catch(err => {
                        console.error(err);
                        return transaction.rollback();
                    });
                });
            });
        });
    }
};
