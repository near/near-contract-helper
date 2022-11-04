/*
* This is intended for use upon starting a local DynamoDB Docker container only
* `run-development-dynamodb.js` should be used to start a local instance process
* */
const { createTables, overrideLocalDynamo } = require('../local_dynamo');

(async function () {
    overrideLocalDynamo();
    await createTables();
}());
