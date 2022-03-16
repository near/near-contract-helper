function* accountGenerator() {
    let accountSuffix = 1;
    while (true) {
        yield `account${accountSuffix++}.near`;
    }
}

const generateAccounts = accountGenerator();
function generateAccountId() {
    return generateAccounts.next().value;
}

function* emailGenerator() {
    let emailSuffix = 1;
    while (true) {
        yield `real-email-${emailSuffix++}@example.com`;
    }
}

const generateEmails = emailGenerator();
function generateEmailAddress() {
    return generateEmails.next().value;
}

function* smsGenerator() {
    let smsSuffix = 1;
    while (true) {
        yield `+1 555-555-${smsSuffix++}000`.slice(0, 15);
    }
}

const generateSms = smsGenerator();
function generateSmsNumber() {
    return generateSms.next().value;
}

module.exports = {
    generateAccountId,
    generateEmailAddress,
    generateSmsNumber,
};
