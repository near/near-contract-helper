const Promise = require('bluebird');
const dynamo = require('dynamodb');
const Joi = require('joi');

const { buildTableName } = require('../utils');

const IdentityVerificationMethod = dynamo.define('IdentityVerificationMethod', {
    hashKey: 'uniqueIdentityKey',
    schema: {
        claimed: Joi.boolean().default(false).required(),
        identityKey: Joi.string().required(),
        kind: Joi.string().valid('email', 'phone').required(),
        securityCode: Joi.string(),
        uniqueIdentityKey: Joi.string().required(),
    },
    tableName: buildTableName('identity_verification_methods'),
    timestamps: true,
});

module.exports = Promise.promisifyAll(IdentityVerificationMethod);
