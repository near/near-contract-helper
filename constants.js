const SERVER_EVENTS = {
    SECURITY_CODE: 'SECURITY_CODE',
    SENT_SMS: 'SENT_SMS',
    SENT_EMAIL: 'SENT_EMAIL'
};

const TWO_FACTOR_AUTH_KINDS = {
    EMAIL: '2fa-email',
    PHONE: '2fa-phone'
};

const RECOVERY_METHOD_KINDS = {
    EMAIL: 'email',
    PHONE: 'phone',
    PHRASE: 'phrase',
    LEDGER: 'ledger',
};

module.exports = {
    SERVER_EVENTS,
    TWO_FACTOR_AUTH_KINDS,
    RECOVERY_METHOD_KINDS
};