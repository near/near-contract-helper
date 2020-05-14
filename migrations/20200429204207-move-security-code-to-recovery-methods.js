'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.addColumn('RecoveryMethods', 'securityCode', {
                    type: Sequelize.STRING
                }, {transaction}),
                queryInterface.removeColumn('Accounts', 'securityCode', {transaction}),
                queryInterface.removeColumn('Accounts', 'confirmed', {transaction}),
            ]);
        });
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.removeColumn('RecoveryMethods', 'securityCode', {transaction}),
                queryInterface.addColumn('Accounts', 'securityCode', {
                    type: Sequelize.STRING
                }, {transaction}),
                queryInterface.addColumn('Accounts', 'confirmed', {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                }, {transaction}),
            ]);
        });
    }
};