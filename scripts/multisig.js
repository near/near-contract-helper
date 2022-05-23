const { program } = require('commander');
const inquirer = require('inquirer');

const { RECOVERY_METHOD_KINDS, TWO_FACTOR_AUTH_KINDS } = require('../constants');
const {
    deleteRecoveryMethod,
    listRecoveryMethodsByAccountId,
    updateRecoveryMethod,
} = require('../db/methods/recovery_method');

function is2faRecoveryMethod(kind) {
    return Object.values(TWO_FACTOR_AUTH_KINDS).includes(kind);
}

function isAccountValid(accountId) {
    if (accountId.length === 64) {
        return true;
    }

    if (process.env.NEAR_WALLET_ENV.startsWith('testnet')) {
        return accountId.endsWith('.testnet');
    }

    return accountId.endsWith('.near');
}

function isEquivalentPhoneNumber(phone1, phone2) {
    const nonDigits = /\D/g;
    return phone1.replace(nonDigits, '') === phone2.replace(nonDigits, '');
}

function printRecoveryMethods(recoveryMethods) {
    recoveryMethods
        .sort(({ kind: kindA }, { kind: kindB }) => {
            if (kindA > kindB) {
                return 1;
            }
            return -1;
        })
        .forEach(({ detail, kind }) => {
            const is2fa = is2faRecoveryMethod(kind);
            if (kind === RECOVERY_METHOD_KINDS.PHRASE || kind === RECOVERY_METHOD_KINDS.LEDGER) {
                console.log(`[${kind}]`);
            } else {
                console.log(`${is2fa ? '*' : ''}[${kind}]: ${detail}`);
            }
        });
}

async function disableMultisig({ accountId,  }) {
    if (!isAccountValid(accountId)) {
        console.error(`Invalid account ID ${accountId}`);
        return;
    }

    const recoveryMethods2fa = await listRecoveryMethodsByAccountId(accountId)
        .filter(({ kind }) => is2faRecoveryMethod(kind));


    if (!recoveryMethods2fa.length) {
        console.log(`\n\nNo 2FA methods found for ${accountId}`);
        return;
    }

    console.log(`\n\nFound ${recoveryMethods2fa.length} 2FA method(s) for ${accountId}:`);
    printRecoveryMethods(recoveryMethods2fa);

    const { delete2faMethods } = await inquirer.prompt({
        name: 'delete2faMethods',
        type: 'confirm',
        message: `This will delete the ${recoveryMethods2fa.length} 2FA method(s) for ${accountId}. Proceed?`,
    });

    if (!delete2faMethods) {
        console.warn('Aborting');
        return;
    }

    await Promise.all(recoveryMethods2fa.map(deleteRecoveryMethod));
    console.log(`Deleted ${recoveryMethods2fa.length} method(s).`);
    console.log(JSON.stringify(recoveryMethods2fa, null, 2));
}

async function lookupRecoveryMethods(accountId) {
    if (!isAccountValid(accountId)) {
        console.error(`Invalid account ID ${accountId}`);
        return;
    }

    const recoveryMethods = await listRecoveryMethodsByAccountId(accountId)
        .map(({ detail, kind }) => ({ detail, kind }));

    if (!recoveryMethods.length) {
        console.log(`\n\nNo recovery methods found for ${accountId}`);
        return;
    }

    console.log(`\n\nFound ${recoveryMethods.length} recovery method(s) for ${accountId}:`);
    printRecoveryMethods(recoveryMethods);
}

async function transferMultisig({ accountId, phone, email }) {
    if (!isAccountValid(accountId)) {
        console.error(`Invalid account ID ${accountId}`);
        return;
    }

    const [sms2faMethod] = await listRecoveryMethodsByAccountId(accountId)
        .filter(({ detail, kind }) => kind === TWO_FACTOR_AUTH_KINDS.PHONE && isEquivalentPhoneNumber(detail, phone));

    if (!sms2faMethod) {
        console.error(`No SMS 2FA recovery method found for account ${accountId} with phone number ${phone}`);
        return;
    }

    const { confirmUpdate } = await inquirer.prompt({
        name: 'confirmUpdate',
        type: 'confirm',
        message: `
            This will update ${accountId}'s current SMS 2FA recovery method for ${phone} to an email 2FA recovery method for ${email}. Proceed?
        `,
    });

    if (!confirmUpdate) {
        console.warn('Aborting');
        return;
    }

    await deleteRecoveryMethod({
        accountId,
        kind: TWO_FACTOR_AUTH_KINDS.PHONE,
    });

    const email2faMethod = await updateRecoveryMethod({
        accountId,
        kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
        publicKey: sms2faMethod.publicKey, // empty for most 2FA recovery method documents but some may have it
    }, {
        detail: email,
        requestId: sms2faMethod.requestId,
        securityCode: null, // clear current security code since user will need to request again
    });

    console.log(JSON.stringify({ oldRecoveryMethod: sms2faMethod, newRecoveryMethod: email2faMethod }, null, 2));
    console.log('Update complete');
}

function multisigCommands() {
    program
        .command('lookup <accountId>')
        .description('Look up recovery methods for an account.')
        .action((accountId) => lookupRecoveryMethods(accountId));

    program
        .command('disable <accountId>')
        .description('Delete the existing 2FA record(s).')
        .action((accountId) => disableMultisig(accountId));

    program
        .command('transfer <accountId> <phone> <email>')
        .description('Transfer SMS 2FA to email for the given account ID. The account must have a SMS 2FA method with the provided phone number.')
        .action((accountId, phone, email) => transferMultisig({ accountId, phone, email }));

    program
        .parse();
}

multisigCommands();
