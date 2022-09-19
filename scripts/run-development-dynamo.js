const { initDevelopmentDynamo } = require('../local_dynamo');

let terminateLocalDynamo = () => {};
let port;

(async function () {
    ({ port, terminateLocalDynamo } = await initDevelopmentDynamo());
    console.warn(`Local DynamoDB instance running on port ${port}`);
}());

process.on('SIGINT', terminateLocalDynamo);
process.on('exit', terminateLocalDynamo);
