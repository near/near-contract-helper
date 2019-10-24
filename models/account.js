'use strict';
module.exports = (sequelize, DataTypes) => {
    const Account = sequelize.define('Account', {
        accountId: DataTypes.STRING,
        phoneNumber: DataTypes.STRING,
        securityCode: DataTypes.STRING,
        confirmed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {});
    // eslint-disable-next-line no-unused-vars
    Account.associate = function(models) {
        // associations can be defined here
    };
    return Account;
};