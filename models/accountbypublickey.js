'use strict';
module.exports = (sequelize, DataTypes) => {
    const AccountByPublicKey = sequelize.define('AccountByPublicKey', {
        accountId: DataTypes.STRING,
        publicKey: DataTypes.STRING
    }, {});
    return AccountByPublicKey;
};