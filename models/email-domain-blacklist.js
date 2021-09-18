'use strict';

module.exports = (sequelize, DataTypes) => {
    const EmailDomainBlacklist = sequelize.define('EmailDomainBlacklist', {
        domainName: {
            allowNull: false,
            primaryKey: true,
            type: DataTypes.STRING
        },
        isTemporaryProvider: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false

        },
    }, {
        timestamps: true,
    });

    return EmailDomainBlacklist;
};
