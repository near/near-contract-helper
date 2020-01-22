'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('Accounts', 'email', {
            type: Sequelize.STRING
        });
    },
    // eslint-disable-next-line no-unused-vars
    down: (queryInterface, Sequelize) => {
        throw new Error('Not implemented');
    }
};