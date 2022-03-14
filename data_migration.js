const Promise = require('bluebird');
const fs = require('fs');
const inquirer = require('inquirer');
const { Pool } = require('pg');

const { getRecoveryMethodByIdentity, deleteRecoveryMethod } = require('./db/methods/recovery_method');
const dbCredentials = require('./db_credentials.json');
const { RECOVERY_METHOD_KINDS } = require('./constants');

async function postMigration() {
    const { runType } = await inquirer.prompt({
        name: 'runType',
        type: 'list',
        message: 'Dry run?',
        choices: ['dry', 'wet'],
    });
    const isWetRun = runType === 'wet';

    const { environment } = await inquirer.prompt({
        name: 'environment',
        type: 'list',
        message: 'Target environment?',
        choices: ['testnet', 'mainnet'],
    });

    const { servicePaused } = await inquirer.prompt({
        name: 'servicePaused',
        type: 'confirm',
        message: 'Is the backend service paused?',
    });

    if (servicePaused) {
        console.log(`Service paused, continuing ${runType} run.`);
    } else {
        if (isWetRun) {
            console.log('Service still live, aborting wet run.');
            return;
        }

        console.log('Service is live, continuing with dry run.');
    }

    const { database, host, password, port, user } = dbCredentials[environment];
    const pool = new Pool({
        connectionString: `postgresql://${user}:${password}@${host}:${port}/${database}?ssl=true`,
    });

    const { rows: kindFrequency } = await pool.query(`
        select "kind", count(*) as frequency
        from "recoverymethods_deleted"
        group by "kind"
    `);

    console.log('Deleted recovery methods:');
    console.log(JSON.stringify(kindFrequency.reduce((hash, { kind, frequency }) => {
        hash[kind] = parseInt(frequency, 10);
        return hash;
    }, {}), null, 2));

    const { deleteRecoveryMethods } = await inquirer.prompt({
        name: 'deleteRecoveryMethods',
        type: 'confirm',
        message: 'Delete the recovery methods from DynamoDB that were deleted in Postgres?',
    });

    if (!deleteRecoveryMethods) {
        console.log('Aborting script.');
    }

    const { rows: deletedRecoveryMethods } = await pool.query(`
        select a."accountId", d."kind", d."detail", d."publicKey", d."deletedAt"
        from "recoverymethods_deleted" as d
        join "Accounts" as a
            on  a."id" = d."AccountId"
    `);

    const recoveryMethods = await Promise.reduce(
        deletedRecoveryMethods,
        async (methodGroups, recoveryMethod) => {
            // non-ledger recovery methods can safely be deleted
            if (recoveryMethod.kind !== RECOVERY_METHOD_KINDS.LEDGER) {
                methodGroups.deletedExpected.push(recoveryMethod);

                if (isWetRun) {
                    try {
                        await deleteRecoveryMethod(recoveryMethod);
                    } catch (error) {
                        methodGroups.deletedFailures.push({ error, recoveryMethod });
                    }
                    methodGroups.deleted.push(recoveryMethod);
                }
            } else {
                // get the current ledger method for this accountId + publicKey
                // if it was created *after* the deletedAt date then the account holder has deleted and
                // recreated the ledger recovery method and should not be deleted in DynamoDB
                const currentMethod = await getRecoveryMethodByIdentity(recoveryMethod);
                const isDeletable = currentMethod && recoveryMethod.deletedAt > currentMethod.createdAt;
                methodGroups.ledger.push({ currentMethod, recoveryMethod });
                if (isDeletable) {
                    methodGroups.deletedExpected.push({ currentMethod, recoveryMethod });
                }

                if (isWetRun) {
                    try {
                        if (isDeletable) {
                            await deleteRecoveryMethod(currentMethod);
                            methodGroups.deleted.push(currentMethod);
                        }
                    } catch (error) {
                        methodGroups.deletedFailures.push({ error, recoveryMethod });
                    }
                }
            }

            return methodGroups;
        },
        {
            deleted: [],
            deletedExpected: [],
            deletedFailures: [],
            ledger: [],
        }
    );

    let resultsPath = `${environment}_data_migration${isWetRun ? '' : '_dry'}.json`;
    let fileExists = fs.existsSync(resultsPath);
    let suffix = 0;
    while (fileExists) {
        resultsPath = resultsPath.split('.').join(`_${++suffix}.`);
        fileExists = fs.existsSync(resultsPath);
    }
    fs.writeFileSync(resultsPath, JSON.stringify(recoveryMethods, null, 2));
}

postMigration();
