'use strict';

const TABLE_NAME = 'IdentityVerificationMethods';
const COLUMN_NAME = 'uniqueIdentityKey';

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface
        .sequelize
        .transaction(transaction => queryInterface.addColumn(
            TABLE_NAME,
            COLUMN_NAME,
            {
                type: Sequelize.DataTypes.STRING,
                allowNull: true
            },
            {
                transaction,
            }
        )),

    down: queryInterface => queryInterface
        .sequelize
        .transaction(transaction => queryInterface.removeColumn(
            TABLE_NAME,
            COLUMN_NAME,
            { transaction }
        )),

};