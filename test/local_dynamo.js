const path = require('path');

const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const Promise = require('bluebird');
const dynamo = require('dynamodb');
const dynamoLocal = require('dynamodb-local');

const Account = require('../src/db/schemas/account');
const EmailDomainBlacklist = require('../src/db/schemas/email_domain_blacklist');
const IdentityVerificationMethod = require('../src/db/schemas/identity_verification_method');
const RecoveryMethod = require('../src/db/schemas/recovery_method');

const LOCAL_DYNAMODB_PORT = 8000;
const TEST_DYNAMODB_PORT = 8001;

async function initLocalDynamo({ dbPath, port } = {}) {
    dynamo.documentClient(new DocumentClient({
        convertEmptyValues: true,
        endpoint: `localhost:${port}`,
        sslEnabled: false,
        region: 'local-env'
    }));

    await dynamoLocal.launch(port, dbPath, dbPath && ['-sharedDb']);

    await Promise.all([
        Account,
        EmailDomainBlacklist,
        IdentityVerificationMethod,
        RecoveryMethod,
    ].map((model) => model.createTableAsync()))
        .catch((e) => {
            if (!dbPath) {
                throw e;
            }
        });

    return {
        port,
        terminateLocalDynamo: () => {
            dynamoLocal.stop(port);
        },
    };
}

module.exports = {
    initDevelopmentDynamo: () => initLocalDynamo({ dbPath: path.join(__dirname, '..'), port: LOCAL_DYNAMODB_PORT }),
    initTestDynamo: () => initLocalDynamo({ port: TEST_DYNAMODB_PORT }),
};
