'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.addColumn('Accounts', 'phoneAddedAt', { type: Sequelize.DATE }, { transaction }),
                queryInterface.addColumn('Accounts', 'emailAddedAt', { type: Sequelize.DATE }, { transaction }),
                queryInterface.addColumn('Accounts', 'phraseAddedAt', { type: Sequelize.DATE }, { transaction }),
            ]);
        });
    },

    down: (queryInterface) => {
        return queryInterface.sequelize.transaction(transaction => {
            return Promise.all([
                queryInterface.removeColumn('Accounts', 'phoneAddedAt', { transaction }),
                queryInterface.removeColumn('Accounts', 'emailAddedAt', { transaction }),
                queryInterface.removeColumn('Accounts', 'phraseAddedAt', { transaction }),
            ]);
        });
    }
};
