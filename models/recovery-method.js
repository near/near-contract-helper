'use strict';
module.exports = (sequelize, DataTypes) => {
    const RecoveryMethod = sequelize.define('RecoveryMethod', {
        kind: {
            // TODO: Does this needs constraint defined somehow besides in migration?
            type: DataTypes.STRING, // 'phone', 'email', or 'phrase'
            allowNull: false
        },
        detail: DataTypes.STRING, // the phone number or email address (null for 'phrase')
        publicKey: DataTypes.STRING,
        securityCode: DataTypes.STRING,
        requestId: DataTypes.STRING
    }, {
        timestamps: true,
    });
    RecoveryMethod.associate = function(models) {
        RecoveryMethod.belongsTo(models.Account);
    };
    return RecoveryMethod;
};
