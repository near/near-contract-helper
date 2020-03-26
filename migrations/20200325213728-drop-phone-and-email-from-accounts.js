'use strict';

module.exports = {
    up: queryInterface => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.removeColumn('Accounts', 'phoneNumber', { transaction }),
                queryInterface.removeColumn('Accounts', 'email', { transaction }),
            ]);
        });
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.addColumn('Accounts', 'phoneNumber', Sequelize.STRING, { transaction }),
                queryInterface.addColumn('Accounts', 'email', Sequelize.STRING, { transaction }),
            ]);
        });
    }
};
