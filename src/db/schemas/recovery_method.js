const Promise = require('bluebird');
const dynamo = require('dynamodb');
const Joi = require('joi');

const Constants = require('../../constants');
const { buildTableName } = require('../utils');
const { RECOVERY_METHOD_KINDS, TWO_FACTOR_AUTH_KINDS } = Constants;

const validRecoveryKinds = [...Object.values(RECOVERY_METHOD_KINDS), ...Object.values(TWO_FACTOR_AUTH_KINDS)];

const RecoveryMethod = dynamo.define('RecoveryMethod', {
    hashKey: 'accountId',
    rangeKey: 'compositeKey',
    schema: {
        accountId: Joi.string().required(),
        compositeKey: Joi.string().required(),
        detail: Joi.string(),
        kind: Joi.string().valid(...validRecoveryKinds).required(),
        publicKey: Joi.string().allow(null),
        requestId: Joi.number().integer(),
        securityCode: Joi.string(),
    },
    tableName: buildTableName('recovery_methods'),
    timestamps: true,
});

module.exports = Promise.promisifyAll(RecoveryMethod);
