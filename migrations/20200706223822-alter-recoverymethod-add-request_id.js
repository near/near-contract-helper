'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('RecoveryMethods', 'requestId', Sequelize.STRING);
    },

    down: (queryInterface) => {
        return queryInterface.removeColumn('RecoveryMethods', 'requestId');
    }
};
