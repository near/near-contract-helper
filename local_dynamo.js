const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const Promise = require('bluebird');
const dynamo = require('dynamodb');
const dynamoLocal = require('dynamodb-local');

const Account = require('./src/db/schemas/account');
const EmailDomainBlacklist = require('./src/db/schemas/email_domain_blacklist');
const IdentityVerificationMethod = require('./src/db/schemas/identity_verification_method');
const RecoveryMethod = require('./src/db/schemas/recovery_method');

const LOCAL_DYNAMODB_HOST = process.env.LOCAL_DYNAMODB_HOST || 'localhost';
const LOCAL_DYNAMODB_PORT = process.env.LOCAL_DYNAMODB_PORT || 7877;
const TEST_DYNAMODB_PORT = process.env.TEST_DYNAMODB_PORT || 7879;

function overrideLocalDynamo({ port } = { port: LOCAL_DYNAMODB_PORT }) {
    dynamo.documentClient(new DocumentClient({
        convertEmptyValues: true,
        endpoint: `${LOCAL_DYNAMODB_HOST}:${port}`,
        sslEnabled: false,
        region: 'local-env'
    }));
}

async function initLocalDynamo({ dbPath, port } = {}) {
    overrideLocalDynamo({ port });
    await dynamoLocal.launch(port, dbPath, dbPath && ['-sharedDb']);

    await Promise.all([
        Account,
        EmailDomainBlacklist,
        IdentityVerificationMethod,
        RecoveryMethod,
    ].map((model) => model.createTableAsync()))
        .catch(() => {});

    return {
        port,
        terminateLocalDynamo: () => {
            console.warn(`Stopping local DynamoDB instance on port ${port}`);
            dynamoLocal.stop(port);
        },
    };
}

module.exports = {
    initDevelopmentDynamo: () => initLocalDynamo({ dbPath: __dirname, port: LOCAL_DYNAMODB_PORT }),
    initTestDynamo: () => initLocalDynamo({ port: TEST_DYNAMODB_PORT }),
    overrideLocalDynamo,
};
