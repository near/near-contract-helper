const Promise = require('bluebird');
const dynamo = require('dynamodb');
const Joi = require('joi');

const { buildTableName } = require('../utils');

const IdentityVerificationMethod = dynamo.define('IdentityVerificationMethod', {
    hashKey: 'identityKey',
    schema: {
        claimed: Joi.boolean().default(false).required(),
        identityKey: Joi.string().required(),
        kind: Joi.string().valid('email', 'phone').required(),
        securityCode: Joi.string(),
        uniqueIdentityKey: Joi.string(),
    },
    tableName: buildTableName('identity_verification_methods'),
    timestamps: true,
    indexes: [{
        name: 'identity_verification_method_unique_identity_key',
        hashKey: 'uniqueIdentityKey',
        type: 'global',
        projection: { ProjectionType: 'KEYS_ONLY' },
    }],
});

module.exports = Promise.promisifyAll(IdentityVerificationMethod);
