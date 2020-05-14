'use strict';
module.exports = (sequelize, DataTypes) => {
    const RecoveryMethod = sequelize.define('RecoveryMethod', {
        kind: {
            type: DataTypes.STRING, // 'phone', 'email', or 'phrase'
            allowNull: false
        },
        detail: DataTypes.STRING, // the phone number or email address (null for 'phrase')
        publicKey: DataTypes.STRING,
        securityCode: DataTypes.STRING
    }, {
        timestamps: true,
    });
    RecoveryMethod.associate = function(models) {
        RecoveryMethod.belongsTo(models.Account);
    };
    return RecoveryMethod;
};
