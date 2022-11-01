/*
* This is intended for use upon starting a local DynamoDB Docker container only
* `run-development-dynamodb.js` should be used to start a local instance process
* */
const { createTables } = require('../local_dynamo');

(async function () {
    await createTables();
}());
