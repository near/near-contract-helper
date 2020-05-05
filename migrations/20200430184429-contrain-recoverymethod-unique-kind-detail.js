'use strict';

module.exports = {
    up: (queryInterface) => {
        return queryInterface.addConstraint(
            'RecoveryMethods',
            ['AccountId', 'kind', 'detail'],
            {
                name: 'constraint_kind_detail',
                type: 'unique',
            }
        );
    },

    down: (queryInterface) => {
        return queryInterface.removeConstraint(
            'RecoveryMethods',
            'constraint_kind_detail'
        );
    }
};
