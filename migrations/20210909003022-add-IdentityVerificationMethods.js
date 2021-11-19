'use strict';

const TABLE_NAME = 'IdentityVerificationMethods';

module.exports = {
    up: async (queryInterface, Sequelize) => queryInterface
        .sequelize
        .transaction(async (transaction) => queryInterface.createTable(
            TABLE_NAME,
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                identityKey: { // the phone number, email address etc.
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                kind: {
                    type: Sequelize.STRING, // email, phone, etc.
                    allowNull: false
                },
                securityCode: {
                    type: Sequelize.STRING
                },
                claimed: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false

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
