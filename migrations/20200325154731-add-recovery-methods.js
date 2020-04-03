'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('RecoveryMethods', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            AccountId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'Accounts',
                    key: 'id'
                },
                onUpdate: 'cascade',
                onDelete: 'cascade',
                allowNull: false
            },
            kind: {
                type: Sequelize.STRING,
                allowNull: false
            },
            detail: { // the phone number or email address
                type: Sequelize.STRING
            },
            publicKey: {
                type: Sequelize.STRING,
                // we don't have values to put in this column for existing Accounts, but we SHOULD forbid null
                // allowNull: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
        });
    },

    down: (queryInterface) => {
        return queryInterface.dropTable('RecoveryMethods');
    }
};
