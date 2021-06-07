'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface
        .sequelize
        .transaction(transaction => queryInterface.addColumn(
            'Accounts',
            'fundedAccountNeedsDeposit',
            {
                type: Sequelize.DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
            {
                transaction,
            }
        )),

    down: queryInterface => queryInterface
        .sequelize
        .transaction(transaction => queryInterface.removeColumn(
            'Accounts',
            'fundedAccountNeedsDeposit',
            { transaction }
        )),

};