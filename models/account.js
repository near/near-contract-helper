'use strict';
module.exports = (sequelize, DataTypes) => {
    const Account = sequelize.define('Account', {
        accountId: DataTypes.STRING,
    }, {
        timestamps: true,
    });
    Account.associate = function(models) {
        Account.hasMany(models.RecoveryMethod);
    };
    return Account;
};
