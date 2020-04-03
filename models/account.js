'use strict';
module.exports = (sequelize, DataTypes) => {
    const Account = sequelize.define('Account', {
        accountId: DataTypes.STRING,
        securityCode: DataTypes.STRING,
        confirmed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
    }, {
        timestamps: true,
    });
    Account.associate = function(models) {
        Account.hasMany(models.RecoveryMethod);
    };
    return Account;
};
