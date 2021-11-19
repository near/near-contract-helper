'use strict';

module.exports = (sequelize, DataTypes) => {
    const IdentityVerificationMethod = sequelize.define('IdentityVerificationMethod', {
        identityKey: {
            type: DataTypes.STRING, // sms # or email address
            allowNull: false
        },
        kind: {
            type: DataTypes.STRING, // 'phone', 'email', etc.
            allowNull: false
        },
        securityCode: DataTypes.STRING,
        claimed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        uniqueIdentityKey: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        timestamps: true,
    });

    return IdentityVerificationMethod;
};
