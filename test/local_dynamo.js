const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const Promise = require('bluebird');
const dynamo = require('dynamodb');
const dynamoLocal = require('dynamodb-local');

const Account = require('../db/schemas/account');
const EmailDomainBlacklist = require('../db/schemas/email_domain_blacklist');
const IdentityVerificationMethod = require('../db/schemas/identity_verification_method');
const RecoveryMethod = require('../db/schemas/recovery_method');

const LOCAL_DYNAMODB_PORT = 8000;

async function initLocalDynamo() {
    dynamo.documentClient(new DocumentClient({
        convertEmptyValues: true,
        endpoint: `localhost:${LOCAL_DYNAMODB_PORT}`,
        sslEnabled: false,
        region: 'local-env'
    }));

    await dynamoLocal.launch(LOCAL_DYNAMODB_PORT);
    await Promise.all([
        Account,
        EmailDomainBlacklist,
        IdentityVerificationMethod,
        RecoveryMethod,
    ].map((model) => model.createTableAsync()));

    return {
        terminateLocalDynamo: () => dynamoLocal.stop(LOCAL_DYNAMODB_PORT),
    };
}

module.exports = initLocalDynamo;
