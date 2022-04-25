const { program } = require('commander');
const inquirer = require('inquirer');

const { TWO_FACTOR_AUTH_KINDS } = require('../constants');
const {
    deleteRecoveryMethod,
    listRecoveryMethodsByAccountId,
    updateRecoveryMethod,
} = require('../db/methods/recovery_method');

function isEquivalentPhoneNumber(phone1, phone2) {
    const nonDigits = /\D/g;
    return phone1.replace(nonDigits, '') === phone2.replace(nonDigits, '');
}

async function transferMultisig() {
    program
        .option('--accountId <string>', 'The account ID whose recovery methods are to be updated')
        .option('--phone <string>', 'The phone number currently used by SMS 2FA')
        .option('--email <string>', 'The email address to use in place of the current 2FA SMS phone number')
        .parse();

    const {
        accountId,
        phone,
        email,
    } = program.opts();

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

    const email2faMethod = await updateRecoveryMethod({
        accountId,
        kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
        publicKey: sms2faMethod.publicKey, // empty for most 2FA recovery method documents but some may have it
    }, {
        detail: email,
        requestId: sms2faMethod.requestId,
        securityCode: null, // clear current security code since user will need to request again
    });

    await deleteRecoveryMethod({
        accountId,
        kind: TWO_FACTOR_AUTH_KINDS.PHONE,
    });

    console.log(JSON.stringify({ oldRecoveryMethod: sms2faMethod, newRecoveryMethod: email2faMethod }, null, 2));
    console.log('Update complete');
}

transferMultisig();
