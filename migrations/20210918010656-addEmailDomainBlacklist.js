'use strict';

const TABLE_NAME = 'EmailDomainBlacklist';

module.exports = {
    up: async (queryInterface, Sequelize) => queryInterface
        .sequelize
        .transaction(async (transaction) => queryInterface.createTable(
            TABLE_NAME,
            {
                domainName: {
                    type: Sequelize.STRING,
                    primaryKey: true,
                    allowNull: false,
                },
                isTemporaryEmailService: {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                },
                hasValidDNSMXRecord: {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                },
                error: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
                staleAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                },
                createdAt: {
                    allowNull: false,
                    type: Sequelize.DATE
                },
                updatedAt: {
                    allowNull: false,
                    type: Sequelize.DATE
                },
            },
            { transaction }
        )),

    down: async (queryInterface) => {
        return queryInterface.dropTable(TABLE_NAME);
    }
};
