const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const Promise = require('bluebird');
const dynamo = Promise.promisifyAll(require('dynamodb'));
const dynamoLocal = require('dynamodb-local');

require('../db/schemas/account');
require('../db/schemas/email_domain_blacklist');
require('../db/schemas/identity_verification_method');
require('../db/schemas/recovery_method');

const LOCAL_DYNAMODB_PORT = 8000;

async function initLocalDynamo() {
    dynamo.documentClient(new DocumentClient({
        convertEmptyValues: true,
        endpoint: `localhost:${LOCAL_DYNAMODB_PORT}`,
        sslEnabled: false,
        region: 'local-env'
    }));

    await dynamoLocal.launch(LOCAL_DYNAMODB_PORT, null);//, ['-shareDb']);
    await dynamo.createTablesAsync();

    return {
        terminateLocalDynamo: () => dynamoLocal.stop(LOCAL_DYNAMODB_PORT),
    };
}

module.exports = initLocalDynamo;
