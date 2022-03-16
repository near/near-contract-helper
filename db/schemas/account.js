const Promise = require('bluebird');
const dynamo = require('dynamodb');
const Joi = require('joi');

const { buildTableName } = require('../utils');

const Account = dynamo.define('Account', {
    hashKey: 'accountId',
    schema: {
        accountId: Joi.string().required(),
        fundedAccountNeedsDeposit: Joi.boolean().default(false),
    },
    tableName: buildTableName('accounts'),
    timestamps: true,
});

module.exports = Promise.promisifyAll(Account);
