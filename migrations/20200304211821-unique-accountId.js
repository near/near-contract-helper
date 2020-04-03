'use strict';

module.exports = {
    up: (queryInterface) => {
        return queryInterface.addIndex(
            'Accounts',
            ['accountId'],
            {
                unique: true,
            }
        );
    },

    down: (queryInterface) => {
        return queryInterface.removeIndex('Accounts', ['accountId']);
    }
};
