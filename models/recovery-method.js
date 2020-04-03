'use strict';
module.exports = (sequelize, DataTypes) => {
    const Account = sequelize.define('RecoveryMethod', {
        kind: {
            type: DataTypes.STRING, // 'phone', 'email', or 'phrase'
            allowNull: false
        },
        detail: DataTypes.STRING, // the phone number or email address (null for 'phrase')
        publicKey: DataTypes.STRING,
    }, {
        timestamps: true,
    });
    Account.associate = function(models) {
        Account.belongsTo(models.Account);
    };
    return Account;
};
