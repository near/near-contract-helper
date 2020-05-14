'use strict';

module.exports = {
    up: (queryInterface) => {
        return queryInterface.addConstraint(
            'RecoveryMethods',
            ['AccountId', 'publicKey', 'kind', 'detail'],
            {
                name: 'constraint_publicKey_kind_detail',
                type: 'unique',
            }
        );
    },

    down: (queryInterface) => {
        return queryInterface.removeConstraint(
            'RecoveryMethods',
            'constraint_publicKey_kind_detail'
        );
    }
};